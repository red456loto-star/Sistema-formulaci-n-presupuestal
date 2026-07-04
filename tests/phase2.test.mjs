
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");

async function json(url, init = {}) {
  const response = await fetch(url, init);
  return { response, body: await response.json() };
}

test("la API local no exige Authorization", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-direct-"));
  const server = await startServer({ port: 0, dataDir });
  context.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });

  const companies = await json(`${server.url}/api/catalog/empresas`);
  assert.equal(companies.response.status, 200);
  assert.ok(companies.body.length >= 1);

  const summary = await json(`${server.url}/api/demo/summary`);
  assert.equal(summary.response.status, 200);
  assert.equal(typeof summary.body.responsables, "number");
  assert.equal("usuarios" in summary.body, false);
});
