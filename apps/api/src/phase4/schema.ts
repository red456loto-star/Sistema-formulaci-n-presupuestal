import { DatabaseManager } from "../../../../packages/database/src/index";
import { ensureImportBatches } from "./schema-batches";
import { ensureImportRows } from "./schema-rows";
import { ensureRealDataSources } from "./schema-sources";

export function ensurePhase4Schema(database: DatabaseManager) {
  const stamp = new Date().toISOString();
  database.connection.transaction(() => {
    ensureImportBatches(database);
    ensureImportRows(database);
    ensureRealDataSources(database);
    database.connection.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (5, ?, ?)").run("importacion_tablas_maestras_fase_4", stamp);
    database.connection.prepare("INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES ('current_phase', '4', ?)").run(stamp);
  })();
}
