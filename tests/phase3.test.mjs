import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };

async function json(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json();
  return { response, body };
}

test("las funciones de Fase 3 siguen operativas dentro de Fase 4", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase3-regression-"));
  const server = await startServer({ port: 0, dataDir });
  context.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });

  const health = await json(`${server.url}/api/health`);
  assert.equal(health.response.status, 200);
  assert.ok(health.body.phase >= 3);
  assert.equal(health.body.accessMode, "directo");

  const auth = await json(`${server.url}/api/auth/login`, { method: "POST", headers, body: "{}" });
  assert.equal(auth.response.status, 404);

  const demo = (await json(`${server.url}/api/catalog/empresas`)).body.find((item) => item.code === "DEMO");
  const pen = (await json(`${server.url}/api/catalog/monedas`)).body.find((item) => item.code === "PEN");
  const responsible = (await json(`${server.url}/api/catalog/responsables?company_id=${demo.id}`)).body[0];
  assert.ok(demo && pen && responsible);

  const exercise = await json(`${server.url}/api/catalog/ejercicios`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, code: "EJ-2028", budget_year: 2028, currency_id: pen.id, active: true }),
  });
  assert.equal(exercise.response.status, 201);

  const periods = await json(`${server.url}/api/catalog/periodos?company_id=${demo.id}&exercise_id=${exercise.body.id}`);
  assert.equal(periods.body.length, 12);
  assert.equal(periods.body[1].end_date, "2028-02-29");

  const projections = await json(`${server.url}/api/catalog/proyecciones?company_id=${demo.id}&exercise_id=${exercise.body.id}`);
  assert.deepEqual(projections.body.map((item) => item.year), [2029, 2030, 2031]);

  const original = await json(`${server.url}/api/catalog/versiones`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, exercise_id: exercise.body.id, code: "ORI-2028-1", name: "Original 2028", version_type: "ORIGINAL", responsible_id: responsible.id }),
  });
  assert.equal(original.response.status, 201);

  const approve = await json(`${server.url}/api/catalog/versiones/${original.body.id}/aprobar`, {
    method: "POST", headers,
    body: JSON.stringify({ responsible_id: responsible.id, notes: "Aprobación de regresión" }),
  });
  assert.equal(approve.response.status, 200);

  const editApproved = await json(`${server.url}/api/catalog/versiones/${original.body.id}`, {
    method: "PATCH", headers, body: JSON.stringify({ name: "Cambio prohibido" }),
  });
  assert.equal(editApproved.response.status, 409);

  const forecast = await json(`${server.url}/api/catalog/versiones`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, exercise_id: exercise.body.id, period_id: periods.body[5].id, code: "FC-2028-1", name: "Forecast junio", version_type: "FORECAST", source_version_id: original.body.id, responsible_id: responsible.id }),
  });
  assert.equal(forecast.response.status, 201);
  assert.equal(forecast.body.message.includes("creada"), true);

  const migration = server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=4").get();
  assert.equal(migration.name, "multiperiodos_multiversiones_fase_3");
});

test("los datos temporales persisten después de reiniciar", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase3-persist-"));
  let server = await startServer({ port: 0, dataDir });
  const demo = (await json(`${server.url}/api/catalog/empresas`)).body.find((item) => item.code === "DEMO");
  const before = await json(`${server.url}/api/catalog/ejercicios?company_id=${demo.id}`);
  assert.ok(before.body.some((item) => item.budget_year === 2027));
  await server.close();

  server = await startServer({ port: 0, dataDir });
  const after = await json(`${server.url}/api/catalog/ejercicios?company_id=${demo.id}`);
  assert.ok(after.body.some((item) => item.budget_year === 2027));
  await server.close();
  await rm(dataDir, { recursive: true, force: true });
});
