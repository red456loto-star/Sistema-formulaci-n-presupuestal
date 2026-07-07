import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensurePhase9Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (10,?,?)")
      .run("variaciones_relevancia_dashboard_fase_9", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key,value,updated_at) VALUES ('current_phase','9',?)")
      .run(stamp);
  })();
}
