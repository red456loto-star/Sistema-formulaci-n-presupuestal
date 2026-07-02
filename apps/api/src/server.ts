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

export interface StartServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
}

export interface StartedServer {
  port: number;
  host: string;
  url: string;
  server: http.Server;
  database: DatabaseManager;
  close: () => Promise<void>;
}

function resolveDataDir(override?: string) {
  if (override) return path.resolve(override);
  if (process.env.PRESUCONTROL_DATA_DIR) return path.resolve(process.env.PRESUCONTROL_DATA_DIR);
  return path.join(os.homedir(), ".presucontrol-empresarial");
}

function createLogger(dataDir: string) {
  const logsDir = path.join(dataDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  return pino(
    { level: process.env.PRESUCONTROL_LOG_LEVEL || "info" },
    pino.destination({ dest: path.join(logsDir, "api.log"), sync: false }),
  );
}

export function createApp(options: StartServerOptions = {}) {
  const dataDir = resolveDataDir(options.dataDir);
  const logger = createLogger(dataDir);
  const database = new DatabaseManager(dataDir);
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on("finish", () => {
      logger.info({ method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - startedAt }, "Solicitud API");
    });
    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "presucontrol-api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      database: database.getStatus().connected ? "conectada" : "no disponible",
    });
  });

  app.get("/api/demo/context", (_request, response) => {
    response.json(database.getDemoContext());
  });

  app.get("/api/demo/summary", (_request, response) => {
    response.json({
      empresas: 1,
      ejercicios: 1,
      versiones: 1,
      periodos: 12,
      mensaje: "Datos mínimos de demostración para verificar frontend, API y SQLite.",
    });
  });

  app.get("/api/system/database-status", (_request, response) => {
    response.json(database.getStatus());
  });

  app.post("/api/system/backup", async (_request, response, next) => {
    try {
      const backupPath = await database.createBackup();
      response.status(201).json({ message: `Respaldo creado correctamente: ${path.basename(backupPath)}`, path: backupPath });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/system/restore-latest", async (_request, response, next) => {
    try {
      const restoredPath = database.restoreLatestBackup();
      response.json({ message: `Base restaurada desde ${path.basename(restoredPath)}.`, path: restoredPath });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/system/log-location", (_request, response) => {
    response.json({ path: path.join(dataDir, "logs", "api.log") });
  });

  app.use((_request, response) => {
    response.status(404).json({ code: "NOT_FOUND", message: "La ruta solicitada no existe." } satisfies ApiErrorResponse);
  });

  const errorHandler: ErrorRequestHandler = (error, _request: Request, response: Response, _next) => {
    logger.error({ error }, "Error no controlado en API");
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: "VALIDATION_ERROR", message: "La información enviada no es válida.", details: error.flatten() } satisfies ApiErrorResponse);
      return;
    }
    response.status(500).json({ code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Se produjo un error interno." } satisfies ApiErrorResponse);
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
  if (!address || typeof address === "string") {
    server.close();
    database.close();
    throw new Error("No se pudo obtener el puerto local de la API.");
  }
  const port = address.port;
  const url = `http://${host}:${port}`;
  logger.info({ host, port, dataDir: database.dataDir }, "API local iniciada");

  return {
    port,
    host,
    url,
    server,
    database,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      database.close();
      logger.flush();
    },
  };
}

const isExecutedDirectly = typeof require !== "undefined" && require.main === module;
if (isExecutedDirectly) {
  startServer().catch((error) => {
    console.error("No se pudo iniciar PresuControl API", error);
    process.exitCode = 1;
  });
}

export type { DemoContext };
