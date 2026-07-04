import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensureImportBatches(database: DatabaseManager) {
  database.connection.exec("CREATE TABLE IF NOT EXISTS import_batches (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, target_table TEXT NOT NULL, file_name TEXT NOT NULL, sheet_name TEXT NOT NULL, operator_name TEXT, source_company_name TEXT, source_url TEXT, source_period TEXT, source_consulted_at TEXT, transformations TEXT, update_existing INTEGER NOT NULL DEFAULT 0 CHECK(update_existing IN (0,1)), status TEXT NOT NULL CHECK(status IN ('ANALIZADO','IMPORTADO','PARCIAL','FALLIDO')), rows_read INTEGER NOT NULL DEFAULT 0, rows_valid INTEGER NOT NULL DEFAULT 0, rows_observed INTEGER NOT NULL DEFAULT 0, rows_rejected INTEGER NOT NULL DEFAULT 0, rows_excluded INTEGER NOT NULL DEFAULT 0, rows_created INTEGER NOT NULL DEFAULT 0, rows_updated INTEGER NOT NULL DEFAULT 0, rows_skipped INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, confirmed_at TEXT)");
  database.connection.exec("CREATE INDEX IF NOT EXISTS idx_import_batches_company_date ON import_batches(company_id, created_at DESC)");
  database.connection.exec("CREATE INDEX IF NOT EXISTS idx_import_batches_target_date ON import_batches(target_table, created_at DESC)");
}
