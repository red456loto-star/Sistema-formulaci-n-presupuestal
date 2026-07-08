import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensurePhase10Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    database.connection.exec(`CREATE TABLE IF NOT EXISTS smtp_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      host TEXT NOT NULL,
      port INTEGER NOT NULL CHECK(port BETWEEN 1 AND 65535),
      secure INTEGER NOT NULL DEFAULT 0 CHECK(secure IN (0,1)),
      username TEXT,
      from_name TEXT NOT NULL,
      from_email TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(company_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS email_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      period_id INTEGER REFERENCES budget_periods(id) ON DELETE SET NULL,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      responsible_id INTEGER NOT NULL REFERENCES responsibles(id) ON DELETE RESTRICT,
      recipient_name TEXT NOT NULL,
      recipient_position TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      attachment_name TEXT NOT NULL,
      attachment_path TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDIENTE','ENVIADO','FALLIDO')),
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0),
      last_attempt_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS improvement_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      period_id INTEGER REFERENCES budget_periods(id) ON DELETE SET NULL,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      center_id INTEGER REFERENCES activity_centers(id) ON DELETE SET NULL,
      element_id INTEGER REFERENCES budget_elements(id) ON DELETE SET NULL,
      account_id INTEGER REFERENCES budget_accounts(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('ORIGINAL','FORECAST','VARIACION','COSTOS','DASHBOARD')),
      problem TEXT NOT NULL,
      evidence_value REAL NOT NULL,
      evidence_unit TEXT NOT NULL,
      evidence_text TEXT NOT NULL,
      probable_cause TEXT NOT NULL,
      proposed_action TEXT NOT NULL,
      expected_impact REAL NOT NULL,
      profitability_impact REAL,
      responsible_id INTEGER NOT NULL REFERENCES responsibles(id) ON DELETE RESTRICT,
      priority TEXT NOT NULL CHECK(priority IN ('ALTA','MEDIA','BAJA')),
      due_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PROPUESTA','APROBADA','EN_EJECUCION','IMPLEMENTADA','DESCARTADA')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_email_deliveries_context ON email_deliveries(company_id,exercise_id,version_id,center_id,status,created_at DESC)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_proposals_context ON improvement_proposals(company_id,exercise_id,version_id,status,priority,created_at DESC)");
    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (11,?,?)")
      .run("reportes_correo_propuestas_fase_10", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('current_phase','10',?)")
      .run(stamp);
  })();
}
