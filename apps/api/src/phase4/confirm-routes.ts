import type { Express, Request, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { confirmSchema } from "./import-route-schemas";
import { importTargets, type TargetKey } from "./catalog-specs";
import { confirmImport } from "./batch-confirm";
import { validateRows } from "./schema-rows";
import type { ExtractedRow } from "./workbook-extract";

function companyForTarget(database: DatabaseManager, target: TargetKey, companyId: number | null | undefined) {
  if (!importTargets[target].companyScoped) return null;
  if (!companyId || !database.connection.prepare("SELECT id FROM companies WHERE id=? AND active=1").get(companyId)) {
    throw Object.assign(new Error("Seleccione una empresa activa para importar esta tabla."), { statusCode: 400 });
  }
  return companyId;
}

function editedRows(target: TargetKey, rows: Array<{ row_number: number; values: Record<string, string | number | null>; excluded: boolean }>): ExtractedRow[] {
  return rows.map((row) => ({
    row_number: row.row_number,
    raw: Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, value === null ? "" : String(value)])),
    values: Object.fromEntries(importTargets[target].fields.map((field) => [field.key, row.values[field.key] === null ? "" : String(row.values[field.key] ?? "")])),
  }));
}

export function registerConfirmRoutes(app: Express, database: DatabaseManager) {
  app.post("/api/import/confirm", (request: Request, response: Response, next) => {
    try {
      const input = confirmSchema.parse(request.body);
      const companyId = companyForTarget(database, input.target_table, input.company_id);
      const normalized = validateRows(database, input.target_table, companyId, editedRows(input.target_table, input.rows));
      normalized.forEach((row, index) => { row.excluded = input.rows[index]?.excluded ?? false; });
      const critical = normalized.filter((row) => row.status === "RECHAZADO" && !row.excluded);
      if (critical.length) throw Object.assign(new Error(`Existen ${critical.length} filas rechazadas. Corríjalas o exclúyalas antes de confirmar.`), { statusCode: 400 });
      response.status(201).json(confirmImport(database, { ...input, company_id: companyId }, normalized));
    } catch (error) { next(error); }
  });
}
