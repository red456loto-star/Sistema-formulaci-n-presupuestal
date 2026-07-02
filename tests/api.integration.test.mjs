import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");

test("API, SQLite y respaldo funcionan de forma integrada", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-test-"));
  const instance = await startServer({ port: 0, dataDir });

  context.after(async () => {
    await instance.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const healthResponse = await fetch(`${instance.url}/api/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.status, "ok");
  assert.equal(health.database, "conectada");

  const contextResponse = await fetch(`${instance.url}/api/demo/context`);
  const demo = await contextResponse.json();
  assert.equal(demo.empresa, "Empresa demostrativa");
  assert.equal(demo.ejercicio, 2027);

  const backupResponse = await fetch(`${instance.url}/api/system/backup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(backupResponse.status, 201);

  const statusResponse = await fetch(`${instance.url}/api/system/database-status`);
  const status = await statusResponse.json();
  assert.equal(status.connected, true);
  assert.ok(status.latestBackup);
});
