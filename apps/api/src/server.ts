import cors from "cors";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import pino from "pino";
import { z } from "zod";
import { DatabaseManager } from "../../../packages/database/src/index";
import type { ApiErrorResponse, DemoContext } from "../../../packages/shared/src/index";
import { registerCompanyRoutes } from "./phase2/company-routes";
import { registerCenterRoutes } from "./phase2/center-routes";
import { registerGroupElementRoutes } from "./phase2/group-element-routes";
import { registerAccountRoutes } from "./phase2/account-routes";
import { registerParameterRoutes } from "./phase2/parameter-routes";
import { registerOrganizationRoutes } from "./phase2/organization-routes";
import { registerExerciseRoutes } from "./phase3/exercise-routes";
import { registerVersionRoutes } from "./phase3/version-routes";
import { ensurePhase4Schema } from "./phase4/schema";
import { registerImportRoutes } from "./phase4/import-routes";
import { ensurePhase5Schema } from "./phase5/schema";
import { registerOriginalBudgetRoutes } from "./phase5/routes";
import { ensurePhase6Schema } from "./phase6/schema";
import { registerMasterBudgetRoutes } from "./phase6/routes";
import { ensurePhase7Schema } from "./phase7/schema";
import { registerPhase7Routes } from "./phase7/routes";
import { ensurePhase8Schema } from "./phase8/schema";
import { registerFinancialAnalysisContextGuard } from "./phase8/context-guard";
import { registerFinancialAnalysisRoutes } from "./phase8/routes";

export interface StartServerOptions { port?: number; host?: string; dataDir?: string; }
export interface StartedServer {
  port: number; host: string; url: string; server: http.Server; database: DatabaseManager; close: () => Promise<void>;
}

function resolveDataDir(override?: string) {
  if (override) return path.resolve(override);
  if (process.env.PRESUCONTROL_DATA_DIR) return path.resolve(process.env.PRESUCONTROL_DATA_DIR);
  return path.join(os.homedir(), ".presucontrol-empresarial");
}

function createLogger(dataDir: string) {
  const logsDir = path.join(dataDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  return pino({ level: process.env.PRESUCONTROL_LOG_LEVEL || "info" }, pino.destination({ dest: path.join(logsDir, "api.log"), sync: false }));
}

export function createApp(options: StartServerOptions = {}) {
  const dataDir = resolveDataDir(options.dataDir);
  const logger = createLogger(dataDir);
  const database = new DatabaseManager(dataDir);
  ensurePhase4Schema(database);
  ensurePhase5Schema(database);
  ensurePhase6Schema(database);
  ensurePhase7Schema(database);
  ensurePhase8Schema(database);
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "30mb" }));
  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on("finish", () => logger.info({ method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - startedAt }, "Solicitud API local"));
    next();
  });

  app.get("/api/health", (_request, response) => response.json({
    status: "ok", service: "presucontrol-api", version: "0.8.0", phase: 8, accessMode: "directo",
    timestamp: new Date().toISOString(), database: database.getStatus().connected ? "conectada" : "no disponible",
  }));

  app.get("/api/demo/context", (_request, response) => response.json(database.getDemoContext()));
  app.get("/api/demo/summary", (_request, response) => {
    const count = (table: string) => (database.connection.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
    response.json({
      empresas: count("companies"),
      responsables: count("responsibles"),
      centros: count("activity_centers"),
      cuentas: count("budget_accounts"),
      ejercicios: count("budget_exercises"),
      versiones: count("budget_versions"),
      periodos: count("budget_periods"),
      importaciones: count("import_batches"),
      lineas_presupuesto_original: count("budget_original_lines"),
      productos_materiales: count("master_items"),
      lineas_ventas: count("master_sales"),
      lineas_inventarios: count("master_inventories"),
      lineas_compras: count("master_purchases"),
      lineas_costos: count("master_costs"),
      lineas_gastos: count("master_expenses"),
      lineas_inversiones: count("master_investments"),
      datos_reales: count("actual_values"),
      versiones_forecast: count("forecast_profiles"),
      lineas_forecast: count("forecast_values"),
      clasificaciones_financieras: count("financial_account_mappings"),
      supuestos_analisis: count("financial_analysis_assumptions"),
      mensaje: "Fase 8: estados financieros, análisis vertical y horizontal, ratios, Dupont y EVA, sin login.",
    });
  });

  registerCompanyRoutes(app, database);
  registerCenterRoutes(app, database);
  registerGroupElementRoutes(app, database);
  registerAccountRoutes(app, database);
  registerParameterRoutes(app, database);
  registerOrganizationRoutes(app, database);
  registerExerciseRoutes(app, database);
  registerVersionRoutes(app, database);
  registerImportRoutes(app, database);
  registerOriginalBudgetRoutes(app, database);
  registerMasterBudgetRoutes(app, database);
  registerPhase7Routes(app, database);
  registerFinancialAnalysisContextGuard(app, database);
  registerFinancialAnalysisRoutes(app, database);

  app.get("/api/system/database-status", (_request, response) => response.json(database.getStatus()));
  app.post("/api/system/backup", async (_request, response, next) => {
    try {
      const backupPath = await database.createBackup();
      response.status(201).json({ message: `Respaldo creado correctamente: ${path.basename(backupPath)}`, path: backupPath });
    } catch (error) { next(error); }
  });
  app.post("/api/system/restore-latest", async (_request, response, next) => {
    try {
      const restoredPath = database.restoreLatestBackup();
      response.json({ message: `Base restaurada desde ${path.basename(restoredPath)}.`, path: restoredPath });
    } catch (error) { next(error); }
  });

  app.use((_request, response) => response.status(404).json({ code: "NOT_FOUND", message: "La ruta solicitada no existe." } satisfies ApiErrorResponse));
  const errorHandler: ErrorRequestHandler = (error, _request: Request, response: Response, _next) => {
    logger.error({ error }, "Error no controlado en API");
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: "VALIDATION_ERROR", message: "La información enviada no es válida.", details: error.flatten() } satisfies ApiErrorResponse);
      return;
    }
    const message = error instanceof Error ? error.message : "Se produjo un error interno.";
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 500);
    if (message.includes("UNIQUE constraint failed")) {
      response.status(409).json({ code: "DUPLICATE", message: "Ya existe un registro con la misma combinación dentro del contexto activo." } satisfies ApiErrorResponse);
      return;
    }
    if (message.includes("CHECK constraint failed")) {
      response.status(400).json({ code: "INVALID_VALUE", message: "Uno de los valores no cumple las reglas permitidas." } satisfies ApiErrorResponse);
      return;
    }
    if (message.includes("FOREIGN KEY constraint failed")) {
      response.status(409).json({ code: "RELATED_DATA", message: "La operación no puede completarse porque existen datos relacionados." } satisfies ApiErrorResponse);
      return;
    }
    response.status(statusCode).json({ code: "INTERNAL_ERROR", message } satisfies ApiErrorResponse);
  };
  app.use(errorHandler);
  return { app, database, logger };
}

export async function startServer(options: StartServerOptions = {}): Promise<StartedServer> {
  const host = options.host || process.env.PRESUCONTROL_HOST || "127.0.0.1";
  const requestedPort = options.port ?? Number(process.env.PRESUCONTROL_PORT || 4310);
  const { app, database, logger } = createApp(options);
  const server = await new Promise<http.Server>((resolve, reject) => {
    const instance = app.listen(requestedPort, host, () => resolve(instance));
    instance.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") { server.close(); database.close(); throw new Error("No se pudo obtener el puerto local de la API."); }
  const port = address.port;
  const url = `http://${host}:${port}`;
  logger.info({ host, port, dataDir: database.dataDir }, "API local iniciada sin autenticación");
  return { port, host, url, server, database, close: async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close(); logger.flush();
  } };
}

const isExecutedDirectly = typeof require !== "undefined" && require.main === module;
if (isExecutedDirectly) startServer().catch((error) => { console.error("No se pudo iniciar PresuControl API", error); process.exitCode = 1; });
export type { DemoContext };
