import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensureImportRows(database: DatabaseManager) {
  database.connection.exec("CREATE TABLE IF NOT EXISTS import_batch_rows (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE, row_number INTEGER NOT NULL, validation_status TEXT NOT NULL CHECK(validation_status IN ('VALIDO','OBSERVADO','RECHAZADO','EXCLUIDO')), action_result TEXT, raw_data TEXT NOT NULL, normalized_data TEXT NOT NULL, errors TEXT, warnings TEXT, created_at TEXT NOT NULL)");
  database.connection.exec("CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON import_batch_rows(batch_id, row_number)");
}
