import type { Express, Request, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { importTargets, suggestedMapping, type TargetKey } from "./catalog-specs";
import { analyzeSchema, fileSchema } from "./import-route-schemas";
import { validateRows } from "./schema-rows";
import { inspectExcel, loadExcel } from "./schema-sources";
import { extractRows } from "./workbook-extract";

function companyForTarget(database: DatabaseManager, target: TargetKey, companyId: number | null | undefined) {
  if (!importTargets[target].companyScoped) return null;
  if (!companyId || !database.connection.prepare("SELECT id FROM companies WHERE id=? AND active=1").get(companyId)) {
    throw Object.assign(new Error("Seleccione una empresa activa para importar esta tabla."), { statusCode: 400 });
  }
  return companyId;
}

export function registerInspectRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/import/catalogs", (_request: Request, response: Response) => response.json(Object.values(importTargets)));

  app.post("/api/import/inspect", async (request: Request, response: Response, next) => {
    try {
      const input = fileSchema.parse(request.body);
      const workbook = await loadExcel(input.content_base64);
      response.json({ file_name: input.file_name, sheets: inspectExcel(workbook) });
    } catch (error) { next(error); }
  });

  app.post("/api/import/analyze", async (request: Request, response: Response, next) => {
    try {
      const input = analyzeSchema.parse(request.body);
      const companyId = companyForTarget(database, input.target_table, input.company_id);
      const missing = importTargets[input.target_table].fields.filter((field) => field.required && !String(input.mapping[field.key] ?? "").trim());
      if (missing.length) throw Object.assign(new Error(`Faltan columnas obligatorias por mapear: ${missing.map((field) => field.label).join(", ")}.`), { statusCode: 400 });
      const workbook = await loadExcel(input.content_base64);
      const extracted = extractRows(workbook, input.sheet_name, input.header_row, input.mapping);
      const rows = validateRows(database, input.target_table, companyId, extracted);
      response.json({
        target: importTargets[input.target_table],
        mapping: input.mapping,
        summary: {
          rows_read: rows.length,
          rows_valid: rows.filter((row) => row.status === "VALIDO").length,
          rows_observed: rows.filter((row) => row.status === "OBSERVADO").length,
          rows_rejected: rows.filter((row) => row.status === "RECHAZADO").length,
          duplicates: rows.filter((row) => row.duplicate).length,
        },
        rows,
      });
    } catch (error) { next(error); }
  });

  app.get("/api/import/suggest/:target", (request: Request, response: Response) => {
    const target = request.params.target as TargetKey;
    if (!importTargets[target]) { response.status(404).json({ code: "NOT_FOUND", message: "Tabla destino no encontrada." }); return; }
    const headers = String(request.query.headers ?? "").split("|").filter(Boolean);
    response.json({ mapping: suggestedMapping(importTargets[target], headers) });
  });
}
