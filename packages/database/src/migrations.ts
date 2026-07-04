export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "base_tecnica_fase_1",
    statements: [
      `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS demo_context (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa TEXT NOT NULL,
        ejercicio INTEGER NOT NULL,
        periodo TEXT NOT NULL,
        version TEXT NOT NULL,
        usuario TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS system_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at)`,
    ],
  },
  {
    version: 2,
    name: "organizacion_estructura_fase_2",
    statements: [
      `CREATE TABLE IF NOT EXISTS currencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        decimals INTEGER NOT NULL DEFAULT 2 CHECK(decimals BETWEEN 0 AND 6),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS exchange_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        currency_id INTEGER NOT NULL REFERENCES currencies(id) ON DELETE RESTRICT,
        rate_date TEXT NOT NULL,
        buy_rate REAL NOT NULL CHECK(buy_rate > 0),
        sell_rate REAL NOT NULL CHECK(sell_rate > 0),
        source TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(currency_id, rate_date)
      )`,
      `CREATE TABLE IF NOT EXISTS units_of_measure (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'GENERAL',
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        commercial_name TEXT NOT NULL,
        legal_name TEXT NOT NULL,
        tax_id TEXT NOT NULL UNIQUE,
        sector TEXT NOT NULL,
        currency_id INTEGER NOT NULL REFERENCES currencies(id) ON DELETE RESTRICT,
        address TEXT,
        email TEXT,
        phone TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        country TEXT NOT NULL DEFAULT 'Perú',
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(company_id, code)
      )`,
      `CREATE TABLE IF NOT EXISTS responsibles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        full_name TEXT NOT NULL,
        position TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(company_id, code),
        UNIQUE(company_id, email)
      )`,
      `CREATE TABLE IF NOT EXISTS activity_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
        responsible_id INTEGER NOT NULL REFERENCES responsibles(id) ON DELETE RESTRICT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        center_type TEXT NOT NULL DEFAULT 'APOYO',
        description TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(company_id, code)
      )`,
      `CREATE TABLE IF NOT EXISTS budget_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(company_id, code)
      )`,
      `CREATE TABLE IF NOT EXISTS budget_elements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES budget_groups(id) ON DELETE RESTRICT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(company_id, code)
      )`,
      `CREATE TABLE IF NOT EXISTS budget_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        element_id INTEGER NOT NULL REFERENCES budget_elements(id) ON DELETE RESTRICT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        nature TEXT NOT NULL CHECK(nature IN ('INGRESO','COSTO','GASTO','ACTIVO','PASIVO','PATRIMONIO')),
        movement_type TEXT NOT NULL DEFAULT 'DETALLE' CHECK(movement_type IN ('DETALLE','ACUMULADORA')),
        description TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(company_id, code)
      )`,
      `CREATE TABLE IF NOT EXISTS center_accounts (
        center_id INTEGER NOT NULL REFERENCES activity_centers(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES budget_accounts(id) ON DELETE CASCADE,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        PRIMARY KEY(center_id, account_id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id INTEGER,
        description TEXT NOT NULL,
        before_data TEXT,
        after_data TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id)`,
      `CREATE INDEX IF NOT EXISTS idx_responsibles_company ON responsibles(company_id)`,
      `CREATE INDEX IF NOT EXISTS idx_centers_company ON activity_centers(company_id)`,
      `CREATE INDEX IF NOT EXISTS idx_groups_company ON budget_groups(company_id)`,
      `CREATE INDEX IF NOT EXISTS idx_elements_company_group ON budget_elements(company_id, group_id)`,
      `CREATE INDEX IF NOT EXISTS idx_accounts_company_element ON budget_accounts(company_id, element_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_company_date ON audit_events(company_id, created_at DESC)`,
    ],
  },
  {
    version: 3,
    name: "acceso_directo_sin_autenticacion",
    statements: [
      `CREATE TABLE audit_events_direct (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id INTEGER,
        description TEXT NOT NULL,
        before_data TEXT,
        after_data TEXT,
        created_at TEXT NOT NULL
      )`,
      `INSERT INTO audit_events_direct (id, company_id, action, entity, entity_id, description, before_data, after_data, created_at)
       SELECT id, company_id, action, entity, entity_id, description, before_data, after_data, created_at FROM audit_events`,
      `DROP TABLE audit_events`,
      `ALTER TABLE audit_events_direct RENAME TO audit_events`,
      `DROP INDEX IF EXISTS idx_sessions_token`,
      `DROP TABLE IF EXISTS sessions`,
      `DROP TABLE IF EXISTS user_roles`,
      `DROP TABLE IF EXISTS role_permissions`,
      `DROP TABLE IF EXISTS permissions`,
      `DROP TABLE IF EXISTS roles`,
      `DROP TABLE IF EXISTS users`,
      `CREATE INDEX IF NOT EXISTS idx_audit_company_date ON audit_events(company_id, created_at DESC)`,
      `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES ('access_mode', 'directo_sin_login', datetime('now'))`,
    ],
  },
];
