
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "./migrations";
import type { DemoContext } from "../../shared/src/index";

function now() { return new Date().toISOString(); }

export class DatabaseManager {
  readonly dataDir: string;
  readonly databasePath: string;
  readonly backupsDir: string;
  private database: Database.Database;

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
    this.databasePath = path.join(this.dataDir, "presucontrol.sqlite");
    this.backupsDir = path.join(this.dataDir, "backups");
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupsDir, { recursive: true });
    this.database = this.openDatabase();
    this.runMigrations();
    this.seedDemoContext();
    this.seedPhase2();
  }

  get connection() { return this.database; }

  private openDatabase() {
    const database = new Database(this.databasePath);
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    database.pragma("busy_timeout = 5000");
    return database;
  }

  private runMigrations() {
    this.database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
    const applied = this.database.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>;
    const appliedVersions = new Set(applied.map((row) => row.version));
    const insertMigration = this.database.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      this.database.transaction(() => {
        for (const statement of migration.statements) this.database.exec(statement);
        insertMigration.run(migration.version, migration.name, now());
      })();
    }
  }

  private seedDemoContext() {
    const count = this.database.prepare("SELECT COUNT(*) AS total FROM demo_context").get() as { total: number };
    if (count.total === 0) {
      this.database.prepare(`INSERT INTO demo_context (empresa, ejercicio, periodo, version, usuario, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run("Empresa demostrativa", 2027, "Enero", "Original 1.0", "Sistema local", now());
    } else {
      this.database.prepare("UPDATE demo_context SET usuario = 'Sistema local'").run();
    }
    this.database.prepare("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .run("schema_version", String(migrations.at(-1)?.version ?? 0), now());
    this.database.prepare("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .run("access_mode", "directo_sin_login", now());
  }

  private seedPhase2() {
    this.database.transaction(() => {
      const stamp = now();
      const insertCurrency = this.database.prepare(`INSERT OR IGNORE INTO currencies (code, name, symbol, decimals, active, created_at, updated_at) VALUES (?, ?, ?, 2, 1, ?, ?)`);
      insertCurrency.run("PEN", "Sol peruano", "S/", stamp, stamp);
      insertCurrency.run("USD", "Dólar estadounidense", "$", stamp, stamp);
      const insertUnit = this.database.prepare(`INSERT OR IGNORE INTO units_of_measure (code, name, category, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`);
      [["UND", "Unidad", "CANTIDAD"], ["KG", "Kilogramo", "PESO"], ["HORA", "Hora", "TIEMPO"], ["MES", "Mes", "TIEMPO"]]
        .forEach((row) => insertUnit.run(...row, stamp, stamp));

      const pen = this.database.prepare("SELECT id FROM currencies WHERE code = 'PEN'").get() as { id: number };
      this.database.prepare(`INSERT OR IGNORE INTO companies
        (code, commercial_name, legal_name, tax_id, sector, currency_id, address, email, phone, active, created_at, updated_at)
        VALUES ('DEMO', 'Empresa demostrativa', 'Empresa Demostrativa S.A.C.', '20999999991', 'Servicios empresariales', ?, 'Lima, Perú', 'contacto@demo.local', '000000000', 1, ?, ?)`)
        .run(pen.id, stamp, stamp);
      const company = this.database.prepare("SELECT id FROM companies WHERE code = 'DEMO'").get() as { id: number };
      this.database.prepare(`INSERT OR IGNORE INTO sites (company_id, code, name, address, city, country, active, created_at, updated_at) VALUES (?, 'LIMA', 'Sede Lima', 'Lima', 'Lima', 'Perú', 1, ?, ?)`)
        .run(company.id, stamp, stamp);
      const site = this.database.prepare("SELECT id FROM sites WHERE company_id = ? AND code = 'LIMA'").get(company.id) as { id: number };
      this.database.prepare(`INSERT OR IGNORE INTO responsibles (company_id, code, full_name, position, email, phone, active, created_at, updated_at) VALUES (?, 'RESP-001', 'Ana Torres', 'Jefa de Administración', 'ana.torres@demo.local', '999000001', 1, ?, ?)`)
        .run(company.id, stamp, stamp);
      const responsible = this.database.prepare("SELECT id FROM responsibles WHERE company_id = ? AND code = 'RESP-001'").get(company.id) as { id: number };

      this.database.prepare(`INSERT OR IGNORE INTO activity_centers
        (company_id, site_id, responsible_id, code, name, center_type, description, active, created_at, updated_at)
        VALUES (?, ?, ?, 'ADM', 'Administración', 'APOYO', 'Centro demostrativo de administración.', 1, ?, ?)`)
        .run(company.id, site.id, responsible.id, stamp, stamp);
      this.database.prepare(`INSERT OR IGNORE INTO budget_groups (company_id, code, name, description, active, created_at, updated_at) VALUES (?, 'GASTOS', 'Gastos operativos', 'Grupo demostrativo de gastos.', 1, ?, ?)`)
        .run(company.id, stamp, stamp);
      const group = this.database.prepare("SELECT id FROM budget_groups WHERE company_id = ? AND code = 'GASTOS'").get(company.id) as { id: number };
      this.database.prepare(`INSERT OR IGNORE INTO budget_elements (company_id, group_id, code, name, description, active, created_at, updated_at) VALUES (?, ?, 'SERVICIOS', 'Servicios de terceros', 'Elemento demostrativo.', 1, ?, ?)`)
        .run(company.id, group.id, stamp, stamp);
      const element = this.database.prepare("SELECT id FROM budget_elements WHERE company_id = ? AND code = 'SERVICIOS'").get(company.id) as { id: number };
      this.database.prepare(`INSERT OR IGNORE INTO budget_accounts
        (company_id, element_id, code, name, nature, movement_type, description, active, created_at, updated_at)
        VALUES (?, ?, '631100', 'Energía eléctrica', 'GASTO', 'DETALLE', 'Cuenta demostrativa.', 1, ?, ?)`)
        .run(company.id, element.id, stamp, stamp);

      this.database.prepare(`INSERT OR IGNORE INTO center_accounts (center_id, account_id, active, created_at)
        SELECT centers.id, accounts.id, 1, ?
        FROM activity_centers centers
        JOIN budget_accounts accounts ON accounts.company_id = centers.company_id
        WHERE centers.active = 1 AND accounts.active = 1`).run(stamp);
    })();
  }

  getDemoContext(): DemoContext {
    return this.database.prepare("SELECT empresa, ejercicio, periodo, version, usuario FROM demo_context ORDER BY id LIMIT 1").get() as DemoContext;
  }

  getStatus() {
    const migrationCount = (this.database.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get() as { total: number }).total;
    const demoRows = (this.database.prepare("SELECT COUNT(*) AS total FROM demo_context").get() as { total: number }).total;
    const companyRows = (this.database.prepare("SELECT COUNT(*) AS total FROM companies").get() as { total: number }).total;
    const latestBackup = this.listBackups()[0] ?? null;
    return {
      connected: this.database.open,
      path: this.databasePath,
      sizeBytes: fs.existsSync(this.databasePath) ? fs.statSync(this.databasePath).size : 0,
      journalMode: String(this.database.pragma("journal_mode", { simple: true })),
      migrationCount,
      demoRows,
      companyRows,
      accessMode: "directo_sin_login",
      latestBackup: latestBackup ? path.basename(latestBackup) : null,
    };
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = path.join(this.backupsDir, `presucontrol-${timestamp}.sqlite`);
    this.database.pragma("wal_checkpoint(TRUNCATE)");
    await this.database.backup(destination);
    this.database.prepare("INSERT INTO system_events (event_type, description, created_at) VALUES (?, ?, ?)").run("BACKUP_CREATED", path.basename(destination), now());
    return destination;
  }

  restoreLatestBackup() {
    const latest = this.listBackups()[0];
    if (!latest) throw new Error("No existe un respaldo disponible para restaurar.");
    this.database.close();
    fs.copyFileSync(latest, this.databasePath);
    this.database = this.openDatabase();
    this.runMigrations();
    this.database.prepare("INSERT INTO system_events (event_type, description, created_at) VALUES (?, ?, ?)").run("BACKUP_RESTORED", path.basename(latest), now());
    return latest;
  }

  private listBackups() {
    if (!fs.existsSync(this.backupsDir)) return [];
    return fs.readdirSync(this.backupsDir)
      .filter((name) => name.endsWith(".sqlite"))
      .map((name) => path.join(this.backupsDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  }

  close() { if (this.database.open) this.database.close(); }
}
