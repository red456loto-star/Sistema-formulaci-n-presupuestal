import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensurePhase5Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    database.connection.exec(`CREATE TABLE IF NOT EXISTS budget_original_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      group_id INTEGER NOT NULL REFERENCES budget_groups(id) ON DELETE RESTRICT,
      element_id INTEGER NOT NULL REFERENCES budget_elements(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      currency_id INTEGER NOT NULL REFERENCES currencies(id) ON DELETE RESTRICT,
      unit_id INTEGER REFERENCES units_of_measure(id) ON DELETE RESTRICT,
      responsible_id INTEGER REFERENCES responsibles(id) ON DELETE SET NULL,
      comment TEXT,
      support TEXT,
      source_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, center_id, account_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS budget_original_monthly_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_id INTEGER NOT NULL REFERENCES budget_original_lines(id) ON DELETE CASCADE,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      budgeted_value REAL NOT NULL DEFAULT 0,
      real_value REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(line_id, period_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS budget_original_projections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_id INTEGER NOT NULL REFERENCES budget_original_lines(id) ON DELETE CASCADE,
      projection_year_id INTEGER NOT NULL REFERENCES projection_years(id) ON DELETE RESTRICT,
      budgeted_value REAL NOT NULL DEFAULT 0,
      real_value REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(line_id, projection_year_id)
    )`);

    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_original_lines_context ON budget_original_lines(company_id, exercise_id, version_id, center_id, account_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_original_monthly_line_period ON budget_original_monthly_values(line_id, period_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_original_projection_line_year ON budget_original_projections(line_id, projection_year_id)");
    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (6, ?, ?)").run("presupuesto_original_fase_5", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES ('current_phase', '5', ?)").run(stamp);
  })();
}
