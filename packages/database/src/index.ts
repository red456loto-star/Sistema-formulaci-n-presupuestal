import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "./migrations";
import type { DemoContext } from "../../shared/src/index";

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
  }

  private openDatabase() {
    const database = new Database(this.databasePath);
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    database.pragma("busy_timeout = 5000");
    return database;
  }

  private runMigrations() {
    this.database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`);

    const applied = this.database.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>;
    const appliedVersions = new Set(applied.map((row) => row.version));
    const insertMigration = this.database.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      const apply = this.database.transaction(() => {
        for (const statement of migration.statements) this.database.exec(statement);
        insertMigration.run(migration.version, migration.name, new Date().toISOString());
      });
      apply();
    }
  }

  private seedDemoContext() {
    const count = this.database.prepare("SELECT COUNT(*) AS total FROM demo_context").get() as { total: number };
    if (count.total > 0) return;
    this.database.prepare(`INSERT INTO demo_context (empresa, ejercicio, periodo, version, usuario, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run("Empresa demostrativa", 2027, "Enero", "Original 1.0", "Administrador local", new Date().toISOString());
    this.database.prepare("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .run("schema_version", String(migrations.at(-1)?.version ?? 0), new Date().toISOString());
  }

  getDemoContext(): DemoContext {
    return this.database.prepare("SELECT empresa, ejercicio, periodo, version, usuario FROM demo_context ORDER BY id LIMIT 1").get() as DemoContext;
  }

  getStatus() {
    const migrationCount = (this.database.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get() as { total: number }).total;
    const demoRows = (this.database.prepare("SELECT COUNT(*) AS total FROM demo_context").get() as { total: number }).total;
    const journalModeResult = this.database.pragma("journal_mode", { simple: true });
    const latestBackup = this.listBackups()[0] ?? null;
    return {
      connected: this.database.open,
      path: this.databasePath,
      sizeBytes: fs.existsSync(this.databasePath) ? fs.statSync(this.databasePath).size : 0,
      journalMode: String(journalModeResult),
      migrationCount,
      demoRows,
      latestBackup: latestBackup ? path.basename(latestBackup) : null,
    };
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = path.join(this.backupsDir, `presucontrol-${timestamp}.sqlite`);
    this.database.pragma("wal_checkpoint(TRUNCATE)");
    await this.database.backup(destination);
    this.database.prepare("INSERT INTO system_events (event_type, description, created_at) VALUES (?, ?, ?)")
      .run("BACKUP_CREATED", path.basename(destination), new Date().toISOString());
    return destination;
  }

  restoreLatestBackup() {
    const latest = this.listBackups()[0];
    if (!latest) throw new Error("No existe un respaldo disponible para restaurar.");
    this.database.close();
    fs.copyFileSync(latest, this.databasePath);
    this.database = this.openDatabase();
    this.runMigrations();
    this.database.prepare("INSERT INTO system_events (event_type, description, created_at) VALUES (?, ?, ?)")
      .run("BACKUP_RESTORED", path.basename(latest), new Date().toISOString());
    return latest;
  }

  private listBackups() {
    if (!fs.existsSync(this.backupsDir)) return [];
    return fs.readdirSync(this.backupsDir)
      .filter((name) => name.endsWith(".sqlite"))
      .map((name) => path.join(this.backupsDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  }

  close() {
    if (this.database.open) this.database.close();
  }
}
