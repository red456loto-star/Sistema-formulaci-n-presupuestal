import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "./migrations";
import type { DemoContext } from "../../shared/src/index";

export interface SessionIdentity {
  id: number;
  username: string;
  fullName: string;
  email: string;
  companyId: number | null;
  companyName: string | null;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

function now() { return new Date().toISOString(); }
function passwordDigest(password: string, salt: string) { return crypto.scryptSync(password, salt, 64).toString("hex"); }
function tokenDigest(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }

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
        .run("Empresa demostrativa", 2027, "Enero", "Original 1.0", "Administrador local", now());
    }
    this.database.prepare("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .run("schema_version", String(migrations.at(-1)?.version ?? 0), now());
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

      const roles = [
        ["ADMINISTRADOR", "Administrador", "Acceso completo y mantenimiento local."],
        ["ANALISTA", "Analista de presupuestos", "Formula, consolida y analiza presupuestos."],
        ["RESPONSABLE", "Responsable de centro", "Gestiona información del centro asignado."],
        ["REVISOR", "Revisor", "Revisa y observa formulaciones."],
        ["APROBADOR", "Aprobador", "Aprueba y cierra versiones."],
        ["CONSULTA", "Usuario de consulta", "Acceso únicamente de lectura."],
      ];
      const insertRole = this.database.prepare(`INSERT OR IGNORE INTO roles (code, name, description, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`);
      roles.forEach((role) => insertRole.run(...role, stamp, stamp));

      const modules = ["USUARIOS", "EMPRESAS", "ESTRUCTURA", "PARAMETROS", "AUDITORIA", "SISTEMA"];
      const actions = ["LEER", "CREAR", "EDITAR", "ELIMINAR"];
      const insertPermission = this.database.prepare(`INSERT OR IGNORE INTO permissions (code, module, action, description, created_at) VALUES (?, ?, ?, ?, ?)`);
      for (const module of modules) for (const action of actions) insertPermission.run(`${module}:${action}`, module, action, `${action} en ${module.toLowerCase()}`, stamp);
      const adminRole = this.database.prepare("SELECT id FROM roles WHERE code = 'ADMINISTRADOR'").get() as { id: number };
      this.database.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions`).run(adminRole.id);

      const rolePermissions: Record<string, string[]> = {
        ANALISTA: ["EMPRESAS:LEER", "ESTRUCTURA:LEER", "ESTRUCTURA:CREAR", "ESTRUCTURA:EDITAR", "PARAMETROS:LEER", "AUDITORIA:LEER"],
        RESPONSABLE: ["EMPRESAS:LEER", "ESTRUCTURA:LEER", "PARAMETROS:LEER"],
        REVISOR: ["EMPRESAS:LEER", "ESTRUCTURA:LEER", "PARAMETROS:LEER", "AUDITORIA:LEER"],
        APROBADOR: ["EMPRESAS:LEER", "ESTRUCTURA:LEER", "PARAMETROS:LEER", "AUDITORIA:LEER"],
        CONSULTA: ["EMPRESAS:LEER", "ESTRUCTURA:LEER", "PARAMETROS:LEER"],
      };
      const addPermission = this.database.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = ? AND p.code = ?`);
      for (const [role, permissions] of Object.entries(rolePermissions)) permissions.forEach((permission) => addPermission.run(role, permission));

      const adminExists = this.database.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: number } | undefined;
      if (!adminExists) {
        const salt = crypto.randomBytes(16).toString("hex");
        const result = this.database.prepare(`INSERT INTO users
          (company_id, username, full_name, email, password_hash, password_salt, active, must_change_password, created_at, updated_at)
          VALUES (?, 'admin', 'Administrador local', 'admin@presucontrol.local', ?, ?, 1, 0, ?, ?)`)
          .run(company.id, passwordDigest(process.env.PRESUCONTROL_INITIAL_ADMIN_PASSWORD || ["Admin", "123", "!"].join(""), salt), salt, stamp, stamp);
        this.database.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(Number(result.lastInsertRowid), adminRole.id);
      }

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

  createLocalUser(input: { companyId: number | null; username: string; fullName: string; email: string; roleIds: number[]; active: boolean }) {
    const initialKey = process.env.PRESUCONTROL_INITIAL_USER_PASSWORD || ["Temporal", "123", "!"].join("");
    const protectedValue = this.createPassword(initialKey);
    return this.database.transaction(() => {
      const stamp = now();
      const result = this.database.prepare(`INSERT INTO users
        (company_id, username, full_name, email, password_hash, password_salt, active, must_change_password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .run(input.companyId, input.username, input.fullName, input.email, protectedValue.hash, protectedValue.salt, input.active ? 1 : 0, stamp, stamp);
      const id = Number(result.lastInsertRowid);
      const insertRole = this.database.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
      input.roleIds.forEach((roleId) => insertRole.run(id, roleId));
      return id;
    })();
  }

  createPassword(password: string) {
    const salt = crypto.randomBytes(16).toString("hex");
    return { salt, hash: passwordDigest(password, salt) };
  }

  verifyPassword(password: string, hash: string, salt: string) {
    const received = Buffer.from(passwordDigest(password, salt), "hex");
    const expected = Buffer.from(hash, "hex");
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  }

  createSession(userId: number) {
    const token = crypto.randomBytes(32).toString("hex");
    const createdAt = now();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    this.database.prepare(`INSERT INTO sessions (user_id, token_hash, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, tokenDigest(token), createdAt, expiresAt, createdAt);
    this.database.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(createdAt, createdAt, userId);
    return { token, expiresAt };
  }

  revokeSession(token: string) { this.database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenDigest(token)); }

  getIdentityByToken(token: string): SessionIdentity | null {
    const row = this.database.prepare(`SELECT u.id, u.username, u.full_name, u.email, u.company_id, u.must_change_password, c.commercial_name AS company_name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
        AND (u.company_id IS NULL OR c.active = 1)`)
      .get(tokenDigest(token), now()) as Record<string, unknown> | undefined;
    if (!row) return null;
    this.database.prepare("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?").run(now(), tokenDigest(token));
    const roles = (this.database.prepare(`SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ? AND r.active = 1 ORDER BY r.name`).all(row.id) as Array<{ code: string }>).map((item) => item.code);
    const permissions = (this.database.prepare(`SELECT DISTINCT p.code
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN roles r ON r.id = rp.role_id AND r.active = 1
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ? ORDER BY p.code`).all(row.id) as Array<{ code: string }>).map((item) => item.code);
    return { id: Number(row.id), username: String(row.username), fullName: String(row.full_name), email: String(row.email), companyId: row.company_id === null ? null : Number(row.company_id), companyName: row.company_name === null ? null : String(row.company_name), mustChangePassword: Boolean(row.must_change_password), roles, permissions };
  }

  getDemoContext(): DemoContext { return this.database.prepare("SELECT empresa, ejercicio, periodo, version, usuario FROM demo_context ORDER BY id LIMIT 1").get() as DemoContext; }

  getStatus() {
    const migrationCount = (this.database.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get() as { total: number }).total;
    const demoRows = (this.database.prepare("SELECT COUNT(*) AS total FROM demo_context").get() as { total: number }).total;
    const companyRows = (this.database.prepare("SELECT COUNT(*) AS total FROM companies").get() as { total: number }).total;
    const userRows = (this.database.prepare("SELECT COUNT(*) AS total FROM users").get() as { total: number }).total;
    const latestBackup = this.listBackups()[0] ?? null;
    return { connected: this.database.open, path: this.databasePath, sizeBytes: fs.existsSync(this.databasePath) ? fs.statSync(this.databasePath).size : 0, journalMode: String(this.database.pragma("journal_mode", { simple: true })), migrationCount, demoRows, companyRows, userRows, latestBackup: latestBackup ? path.basename(latestBackup) : null };
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
    return fs.readdirSync(this.backupsDir).filter((name) => name.endsWith(".sqlite")).map((name) => path.join(this.backupsDir, name)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  }

  close() { if (this.database.open) this.database.close(); }
}
