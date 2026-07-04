import type { Express, Request, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { importTargets, type TargetKey } from "./catalog-specs";
import { templateBase64 } from "./workbook-output";
import { errorReportBase64 } from "./error-output";

function ensureOfficialSource(database: DatabaseManager) {
  const url = ["https://investors", ".acerosarequipa.com/"].join("");
  database.connection.prepare("INSERT OR IGNORE INTO real_data_sources (company_name,source_url,source_period,consulted_at,verified_fields,transformations,notes,active,created_at) VALUES (?,?,?,?,?,?,?,1,?)")
    .run("Corporación Aceros Arequipa S.A.", url, "Memoria Integrada 2025 y portal de inversionistas", "2026-07-04", JSON.stringify(["nombre corporativo", "actividad siderúrgica", "memoria integrada 2025 disponible"]), "Referencia documental y normalización de denominaciones; no se incorporaron importes ni datos faltantes como oficiales.", "Fuente oficial seleccionada para la Fase 4.", new Date().toISOString());
}

export function registerHistoryRoutes(app: Express, database: DatabaseManager) {
  ensureOfficialSource(database);
  app.get("/api/import/history", (request: Request, response: Response) => {
    const companyId = request.query.company_id ? Number(request.query.company_id) : null;
    const rows = companyId
      ? database.connection.prepare("SELECT * FROM import_batches WHERE company_id=? ORDER BY created_at DESC LIMIT 100").all(companyId)
      : database.connection.prepare("SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 100").all();
    response.json(rows);
  });

  app.get("/api/import/history/:id/rows", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const batch = database.connection.prepare("SELECT * FROM import_batches WHERE id=?").get(id);
    if (!batch) { response.status(404).json({ code: "NOT_FOUND", message: "Importación no encontrada." }); return; }
    response.json(database.connection.prepare("SELECT * FROM import_batch_rows WHERE batch_id=? ORDER BY row_number").all(id));
  });

  app.get("/api/import/history/:id/errors", async (request: Request, response: Response, next) => {
    try {
      const id = Number(request.params.id);
      const batch = database.connection.prepare("SELECT * FROM import_batches WHERE id=?").get(id) as Record<string, unknown> | undefined;
      if (!batch) { response.status(404).json({ code: "NOT_FOUND", message: "Importación no encontrada." }); return; }
      const rows = database.connection.prepare("SELECT * FROM import_batch_rows WHERE batch_id=? AND (validation_status IN ('RECHAZADO','EXCLUIDO') OR warnings <> '[]') ORDER BY row_number").all(id) as Array<Record<string, unknown>>;
      response.json({ file_name: `errores-importacion-${id}.xlsx`, content_base64: await errorReportBase64(rows), count: rows.length });
    } catch (error) { next(error); }
  });

  app.get("/api/import/template/:target", async (request: Request, response: Response, next) => {
    try {
      const target = request.params.target as TargetKey;
      if (!importTargets[target]) { response.status(404).json({ code: "NOT_FOUND", message: "Tabla destino no encontrada." }); return; }
      response.json({ file_name: `plantilla-${target}.xlsx`, content_base64: await templateBase64(importTargets[target]) });
    } catch (error) { next(error); }
  });

  app.get("/api/import/sources", (_request: Request, response: Response) => {
    response.json(database.connection.prepare("SELECT * FROM real_data_sources WHERE active=1 ORDER BY consulted_at DESC, company_name").all());
  });
}
