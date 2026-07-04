import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensureRealDataSources(database: DatabaseManager) {
  database.connection.exec("CREATE TABLE IF NOT EXISTS real_data_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL, source_url TEXT NOT NULL, source_period TEXT, consulted_at TEXT NOT NULL, verified_fields TEXT NOT NULL, transformations TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL, UNIQUE(company_name, source_url))");
  database.connection.exec("CREATE INDEX IF NOT EXISTS idx_real_sources_company ON real_data_sources(company_name, active)");
}
