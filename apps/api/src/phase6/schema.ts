import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensurePhase6Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('PRODUCTO','MATERIAL')),
      unit_id INTEGER REFERENCES units_of_measure(id) ON DELETE RESTRICT,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(company_id, code)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      item_id INTEGER NOT NULL REFERENCES master_items(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      quantity REAL NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      unit_price REAL NOT NULL DEFAULT 0 CHECK(unit_price >= 0),
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, period_id, item_id, center_id, account_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_inventories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      item_id INTEGER NOT NULL REFERENCES master_items(id) ON DELETE RESTRICT,
      initial_quantity REAL NOT NULL DEFAULT 0 CHECK(initial_quantity >= 0),
      entries_quantity REAL NOT NULL DEFAULT 0 CHECK(entries_quantity >= 0),
      exits_quantity REAL NOT NULL DEFAULT 0 CHECK(exits_quantity >= 0),
      desired_final_quantity REAL NOT NULL DEFAULT 0 CHECK(desired_final_quantity >= 0),
      unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost >= 0),
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, period_id, item_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      item_id INTEGER NOT NULL REFERENCES master_items(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      needs_quantity REAL NOT NULL DEFAULT 0 CHECK(needs_quantity >= 0),
      initial_inventory_quantity REAL NOT NULL DEFAULT 0 CHECK(initial_inventory_quantity >= 0),
      desired_final_quantity REAL NOT NULL DEFAULT 0 CHECK(desired_final_quantity >= 0),
      unit_price REAL NOT NULL DEFAULT 0 CHECK(unit_price >= 0),
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, period_id, item_id, center_id, account_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      item_id INTEGER REFERENCES master_items(id) ON DELETE SET NULL,
      cost_category TEXT NOT NULL CHECK(cost_category IN ('MATERIALES','MANO_OBRA','CIF')),
      behavior TEXT NOT NULL CHECK(behavior IN ('FIJO','VARIABLE')),
      traceability TEXT NOT NULL CHECK(traceability IN ('DIRECTO','INDIRECTO')),
      quantity REAL NOT NULL DEFAULT 1 CHECK(quantity >= 0),
      unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost >= 0),
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      behavior TEXT NOT NULL CHECK(behavior IN ('FIJO','VARIABLE')),
      traceability TEXT NOT NULL CHECK(traceability IN ('DIRECTO','INDIRECTO')),
      amount REAL NOT NULL DEFAULT 0 CHECK(amount >= 0),
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, period_id, center_id, account_id)
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE RESTRICT,
      period_id INTEGER NOT NULL REFERENCES budget_periods(id) ON DELETE RESTRICT,
      center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE RESTRICT,
      account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE RESTRICT,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0 CHECK(amount >= 0),
      useful_life_months INTEGER CHECK(useful_life_months IS NULL OR useful_life_months > 0),
      financing_source TEXT NOT NULL DEFAULT 'CAJA' CHECK(financing_source IN ('CAJA','DEUDA','CAPITAL')),
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    database.connection.exec(`CREATE TABLE IF NOT EXISTS master_financial_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES budget_exercises(id) ON DELETE RESTRICT,
      version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
      tax_rate REAL NOT NULL DEFAULT 29.5 CHECK(tax_rate >= 0 AND tax_rate <= 100),
      collection_rate REAL NOT NULL DEFAULT 100 CHECK(collection_rate >= 0 AND collection_rate <= 100),
      payment_rate REAL NOT NULL DEFAULT 100 CHECK(payment_rate >= 0 AND payment_rate <= 100),
      opening_cash REAL NOT NULL DEFAULT 0,
      opening_receivables REAL NOT NULL DEFAULT 0 CHECK(opening_receivables >= 0),
      opening_ppe REAL NOT NULL DEFAULT 0 CHECK(opening_ppe >= 0),
      opening_payables REAL NOT NULL DEFAULT 0 CHECK(opening_payables >= 0),
      opening_debt REAL NOT NULL DEFAULT 0 CHECK(opening_debt >= 0),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(company_id, exercise_id, version_id)
    )`);

    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_sales_context ON master_sales(company_id,exercise_id,version_id,period_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_inventory_context ON master_inventories(company_id,exercise_id,version_id,period_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_purchases_context ON master_purchases(company_id,exercise_id,version_id,period_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_costs_context ON master_costs(company_id,exercise_id,version_id,period_id,center_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_expenses_context ON master_expenses(company_id,exercise_id,version_id,period_id,center_id)");
    database.connection.exec("CREATE INDEX IF NOT EXISTS idx_master_investments_context ON master_investments(company_id,exercise_id,version_id,period_id,center_id)");

    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (7,?,?)")
      .run("presupuesto_maestro_fase_6", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('current_phase','6',?)")
      .run(stamp);
  })();
}
