import { DatabaseManager } from "../../../../packages/database/src/index";
import { importTargets, TargetKey } from "./catalog-specs";
import { ExtractedRow } from "./workbook-extract";
import { normalizeExtractedRow } from "./import-types";
import { validateRelations } from "./row-relations";
import { duplicateExists, fileKey } from "./row-duplicates";

export function ensureImportRows(database: DatabaseManager) {
  database.connection.exec("CREATE TABLE IF NOT EXISTS import_batch_rows (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE, row_number INTEGER NOT NULL, validation_status TEXT NOT NULL CHECK(validation_status IN ('VALIDO','OBSERVADO','RECHAZADO','EXCLUIDO')), action_result TEXT, raw_data TEXT NOT NULL, normalized_data TEXT NOT NULL, errors TEXT, warnings TEXT, created_at TEXT NOT NULL)");
  database.connection.exec("CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON import_batch_rows(batch_id, row_number)");
}

export function validateRows(database: DatabaseManager, target: TargetKey, companyId: number | null, extracted: ExtractedRow[]) {
  const seen = new Set<string>();
  return extracted.map((source) => {
    const row = normalizeExtractedRow(importTargets[target], source);
    validateRelations(database, target, companyId, row);
    const key = fileKey(target, row);
    if (key && seen.has(key)) row.errors.push("Registro duplicado dentro del mismo archivo.");
    if (key) seen.add(key);
    row.duplicate = row.errors.length === 0 && duplicateExists(database, target, companyId, row);
    if (row.duplicate) row.warnings.push("El registro ya existe; puede actualizarlo al confirmar.");
    row.status = row.errors.length ? "RECHAZADO" : row.warnings.length ? "OBSERVADO" : "VALIDO";
    return row;
  });
}
