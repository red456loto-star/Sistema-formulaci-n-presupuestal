import { DatabaseManager } from "../../../../packages/database/src/index";

const defaultBudgetTypes = [
  [
    "ORIGINAL_ANUAL_PROYECTADO",
    "Presupuesto original anual y proyección a 3 años",
    "OTRO",
    10,
    "Permite formular el presupuesto original anual del próximo periodo con detalle mensual y proyectar los tres años posteriores con detalle anual.",
  ],
  [
    "FORECAST_REVISADO",
    "Presupuesto revisado forecast",
    "OTRO",
    20,
    "Permite formular el presupuesto revisado con información real hasta cierto periodo y valores proyectados presupuestados para los periodos restantes.",
  ],
] as const;

const formerMasterComponentCodes = [
  "VENTAS", "PRODUCCION", "COMPRAS", "COSTOS", "GASTOS", "INVERSIONES", "CAJA",
  "ESTADO_RESULTADOS", "ESTADO_SITUACION", "FLUJO_EFECTIVO",
];

export function seedBudgetTypes(database: DatabaseManager, companyId?: number) {
  const companies = companyId
    ? [{ id: companyId }]
    : database.connection.prepare("SELECT id FROM companies WHERE active=1").all() as Array<{ id: number }>;
  const stamp = new Date().toISOString();
  const insert = database.connection.prepare(`INSERT OR IGNORE INTO budget_types
    (company_id,code,name,category,description,sort_order,active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,1,?,?)`);
  const update = database.connection.prepare("UPDATE budget_types SET name=?,category=?,description=?,sort_order=?,active=1,updated_at=? WHERE company_id=? AND code=?");
  const deactivateFormerComponents = database.connection.prepare(`UPDATE budget_types SET active=0,updated_at=?
    WHERE company_id=? AND code IN (${formerMasterComponentCodes.map(() => "?").join(",")})`);
  for (const company of companies) {
    deactivateFormerComponents.run(stamp, company.id, ...formerMasterComponentCodes);
    for (const [code, name, category, sortOrder, description] of defaultBudgetTypes) {
      insert.run(company.id, code, name, category, description, sortOrder, stamp, stamp);
      update.run(name, category, description, sortOrder, stamp, company.id, code);
    }
  }
}

export function ensurePhase11Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    database.connection.exec(`CREATE TABLE IF NOT EXISTS budget_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('OPERATIVO','COSTOS','FINANCIERO','ESTADO_FINANCIERO','OTRO')),
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 100,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(company_id,code)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_data_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      budget_type_id INTEGER NOT NULL REFERENCES budget_types(id) ON DELETE RESTRICT,
      data_kind TEXT NOT NULL CHECK(data_kind IN ('PRESUPUESTADO','REAL')),
      source_file TEXT,
      source_label TEXT,
      source_url TEXT,
      source_period TEXT,
      operator_name TEXT,
      wacc_rate REAL CHECK(wacc_rate IS NULL OR (wacc_rate >= 0 AND wacc_rate <= 100)),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(company_id,exercise_id,period_id,version_id,budget_type_id,data_kind)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_data_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_id INTEGER NOT NULL REFERENCES master_data_sets(id) ON DELETE CASCADE,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      budget_type_id INTEGER NOT NULL REFERENCES budget_types(id) ON DELETE RESTRICT,
      data_kind TEXT NOT NULL CHECK(data_kind IN ('PRESUPUESTADO','REAL')),
      row_order INTEGER NOT NULL DEFAULT 1,
      center_id INTEGER REFERENCES activity_centers(id) ON DELETE SET NULL,
      center_code TEXT,
      center_name TEXT,
      element_id INTEGER REFERENCES budget_elements(id) ON DELETE SET NULL,
      element_code TEXT,
      element_name TEXT,
      account_id INTEGER REFERENCES budget_accounts(id) ON DELETE SET NULL,
      account_code TEXT,
      account_name TEXT,
      account_nature TEXT CHECK(account_nature IS NULL OR account_nature IN ('INGRESO','COSTO','GASTO','ACTIVO','PASIVO','PATRIMONIO')),
      line_code TEXT,
      line_name TEXT NOT NULL,
      statement_section TEXT CHECK(statement_section IS NULL OR statement_section IN ('PRESUPUESTO','ESTADO_RESULTADOS','ESTADO_SITUACION','FLUJO_EFECTIVO')),
      financial_item TEXT,
      cost_behavior TEXT CHECK(cost_behavior IS NULL OR cost_behavior IN ('FIJO','VARIABLE','NO_APLICA')),
      cost_traceability TEXT CHECK(cost_traceability IS NULL OR cost_traceability IN ('DIRECTO','INDIRECTO','NO_APLICA')),
      quantity REAL,
      unit_price REAL,
      amount REAL NOT NULL,
      source_reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS phase11_improvement_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      budget_type_id INTEGER NOT NULL REFERENCES budget_types(id) ON DELETE RESTRICT,
      center_id INTEGER REFERENCES activity_centers(id) ON DELETE SET NULL,
      element_id INTEGER REFERENCES budget_elements(id) ON DELETE SET NULL,
      account_id INTEGER REFERENCES budget_accounts(id) ON DELETE SET NULL,
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

    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_budget_types_company ON budget_types(company_id,active,sort_order)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_sets_context ON master_data_sets(company_id,exercise_id,period_id,version_id,budget_type_id,data_kind)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_rows_context ON master_data_rows(company_id,exercise_id,period_id,version_id,budget_type_id,data_kind)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_rows_dimension ON master_data_rows(center_id,element_id,account_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_phase11_proposals_context ON phase11_improvement_proposals(company_id,exercise_id,period_id,version_id,budget_type_id,status)");
    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (12,?,?)")
      .run("correcciones_jerarquia_datos_maestros", stamp);
    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (13,?,?)")
      .run("corr_2_tipos_presupuesto_y_presupuesto_maestro", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('current_release','12',?)").run(stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('current_phase','12',?)").run(stamp);
    seedBudgetTypes(database);
  })();
}
