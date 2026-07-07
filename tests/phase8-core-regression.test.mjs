import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");

async function get(server, route) {
  const response = await fetch(`${server.url}${route}`);
  return { response, body: await response.json().catch(() => null) };
}

test("Fase 8 conserva API, SQLite y acceso directo", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pc-f8-core-"));
  const server = await startServer({ port: 0, dataDir });
  t.after(async () => {
    await server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await get(server, "/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.phase, 8);
  assert.equal(health.body.version, "0.8.1");
  assert.equal(health.body.accessMode, "directo");

  const company = (await get(server, "/api/catalog/empresas")).body.find((row) => row.code === "DEMO");
  const mappings = await get(server, `/api/financial-analysis/mappings?company_id=${company.id}`);
  assert.equal(mappings.response.status, 200);
  assert.ok(Array.isArray(mappings.body));

  const migration = server.database.connection
    .prepare("SELECT name FROM schema_migrations WHERE version=9")
    .get();
  assert.equal(migration.name, "estados_y_analisis_financiero_fase_8");

  const authResponse = await fetch(`${server.url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(authResponse.status, 404);
});
