import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensurePhase7Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    database.connection.exec(`CREATE TABLE IF NOT EXISTS actual_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      original_version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      budget_type TEXT NOT NULL CHECK(budget_type IN ('PRESUPUESTO_ORIGINAL','VENTAS','INVENTARIOS','COMPRAS','PRODUCCION','COSTOS','GASTOS','INVERSIONES','RESULTADOS','SITUACION_FINANCIERA')),
      budgeted_value REAL NOT NULL DEFAULT 0,
      actual_value REAL NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('REAL_PUBLICADO','REAL_INTERNO','DERIVADO','DEMOSTRATIVO')),
      source_reference TEXT NOT NULL,
      source_period TEXT,
      source_date TEXT,
      responsible_id INTEGER REFERENCES responsibles(id) ON DELETE SET NULL,
      comment TEXT,
      registered_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(original_version_id,period_id,center_id,account_id,budget_type)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS actual_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      original_version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      file_name TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      operator_text TEXT,
      rows_read INTEGER NOT NULL DEFAULT 0,
      rows_valid INTEGER NOT NULL DEFAULT 0,
      rows_rejected INTEGER NOT NULL DEFAULT 0,
      rows_created INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS forecast_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      forecast_version_id INTEGER NOT NULL UNIQUE REFERENCES budget_versions(id) ON DELETE CASCADE,
      original_version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      cutoff_period_number INTEGER NOT NULL CHECK(cutoff_period_number BETWEEN 1 AND 12),
      revision_number INTEGER NOT NULL CHECK(revision_number > 0),
      responsible_id INTEGER REFERENCES responsibles(id) ON DELETE SET NULL,
      observation TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(original_version_id,revision_number)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS forecast_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      forecast_version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
      original_version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      group_id INTEGER NOT NULL REFERENCES budget_groups(id) ON DELETE RESTRICT,
      element_id INTEGER NOT NULL REFERENCES budget_elements(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      original_budget REAL NOT NULL DEFAULT 0,
      actual_value REAL,
      projected_value REAL,
      forecast_value REAL NOT NULL DEFAULT 0,
      value_origin TEXT NOT NULL CHECK(value_origin IN ('REAL','PROYECCION')),
      comment TEXT,
      source_reference TEXT,
      responsible_id INTEGER REFERENCES responsibles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(forecast_version_id,period_id,center_id,account_id)
    )`);

    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_actual_context ON actual_values(company_id,exercise_id,original_version_id,period_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_actual_dimensions ON actual_values(center_id,account_id,budget_type)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_forecast_profile_context ON forecast_profiles(company_id,exercise_id,original_version_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_forecast_values_version ON forecast_values(forecast_version_id,period_id,center_id,account_id)");

    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (8,?,?)")
      .run("informacion_real_forecast_fase_7", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('current_phase','7',?)")
      .run(stamp);
  })();
}
