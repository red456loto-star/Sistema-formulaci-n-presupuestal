import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensurePhase8Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    database.connection.exec(`CREATE TABLE IF NOT EXISTS financial_account_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE CASCADE,
      statement_section TEXT NOT NULL CHECK(statement_section IN (
        'SALES','COST_OF_SALES','OPERATING_EXPENSE','INCOME_TAX',
        'CURRENT_ASSET','NONCURRENT_ASSET','CURRENT_LIABILITY','NONCURRENT_LIABILITY','EQUITY','IGNORE'
      )),
      ratio_role TEXT CHECK(ratio_role IS NULL OR ratio_role IN ('CASH','RECEIVABLES','INVENTORY','OTHER')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(company_id, account_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS financial_analysis_assumptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE CASCADE,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL CHECK(source_type IN ('ORIGINAL','FORECAST','REAL')),
      tax_rate REAL CHECK(tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate <= 100)),
      cost_of_capital_rate REAL CHECK(cost_of_capital_rate IS NULL OR (cost_of_capital_rate >= 0 AND cost_of_capital_rate <= 100)),
      invested_capital_override REAL CHECK(invested_capital_override IS NULL OR invested_capital_override >= 0),
      source_reference TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(company_id, exercise_id, version_id, source_type)
    )`);

    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_financial_mapping_company ON financial_account_mappings(company_id,statement_section)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_financial_assumptions_context ON financial_analysis_assumptions(company_id,exercise_id,version_id,source_type)");

    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (9,?,?)")
      .run("estados_y_analisis_financiero_fase_8", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('current_phase','8',?)")
      .run(stamp);
  })();
}
