import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensurePhase4Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.exec("CREATE TABLE IF NOT EXISTS import_batches (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER, target_table TEXT NOT NULL, file_name TEXT NOT NULL, sheet_name TEXT NOT NULL, status TEXT NOT NULL, rows_read INTEGER NOT NULL DEFAULT 0, rows_created INTEGER NOT NULL DEFAULT 0, rows_updated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, confirmed_at TEXT)");
  database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (5, ?, ?)").run("importacion_tablas_maestras_fase_4", stamp);
  database.connection.prepare("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES ('current_phase', '4', ?)").run(stamp);
}
