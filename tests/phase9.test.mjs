import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");

test("Fase 9 conserva acceso directo y activa su migración", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pc-phase9-"));
  const server = await startServer({ port: 0, dataDir });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  const response = await fetch(`${server.url}/api/health`);
  const health = await response.json();
  assert.equal(health.version, "0.9.0");
  assert.equal(health.phase, 9);
  assert.equal(health.accessMode, "directo");
  const migration = server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=10").get();
  assert.equal(migration.name, "variaciones_relevancia_dashboard_fase_9");
});
