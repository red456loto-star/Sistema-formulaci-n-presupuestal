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

test("Fase 3 gestiona ejercicios, doce periodos, proyección y versiones sin login", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase3-"));
  const server = await startServer({ port: 0, dataDir });
  context.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });

  const health = await json(`${server.url}/api/health`);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.phase, 3);
  assert.equal(health.body.accessMode, "directo");

  const auth = await json(`${server.url}/api/auth/login`, { method: "POST", headers, body: "{}" });
  assert.equal(auth.response.status, 404);

  const companies = await json(`${server.url}/api/catalog/empresas`);
  const demo = companies.body.find((item) => item.code === "DEMO");
  assert.ok(demo);
  const currencies = await json(`${server.url}/api/catalog/monedas`);
  const pen = currencies.body.find((item) => item.code === "PEN");
  assert.ok(pen);
  const responsibles = await json(`${server.url}/api/catalog/responsables?company_id=${demo.id}`);
  const responsible = responsibles.body[0];
  assert.ok(responsible);

  const exerciseCreate = await json(`${server.url}/api/catalog/ejercicios`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, code: "EJ-2028", budget_year: 2028, currency_id: pen.id, notes: "Prueba de año bisiesto", active: true }),
  });
  assert.equal(exerciseCreate.response.status, 201);
  const exerciseId = exerciseCreate.body.id;

  const duplicateExercise = await json(`${server.url}/api/catalog/ejercicios`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, code: "OTRO-2028", budget_year: 2028, currency_id: pen.id, active: true }),
  });
  assert.equal(duplicateExercise.response.status, 409);

  const periods = await json(`${server.url}/api/catalog/periodos?company_id=${demo.id}&exercise_id=${exerciseId}`);
  assert.equal(periods.response.status, 200);
  assert.equal(periods.body.length, 12);
  assert.equal(periods.body[1].name, "Febrero");
  assert.equal(periods.body[1].end_date, "2028-02-29");

  const projections = await json(`${server.url}/api/catalog/proyecciones?company_id=${demo.id}&exercise_id=${exerciseId}`);
  assert.equal(projections.response.status, 200);
  assert.deepEqual(projections.body.map((item) => item.year), [2029, 2030, 2031]);

  const closePeriod = await json(`${server.url}/api/catalog/periodos/${periods.body[0].id}/cerrar`, {
    method: "POST", headers, body: JSON.stringify({ responsible_id: responsible.id, notes: "Cierre mensual de prueba" }),
  });
  assert.equal(closePeriod.response.status, 200);
  const closedPeriods = await json(`${server.url}/api/catalog/periodos?company_id=${demo.id}&exercise_id=${exerciseId}`);
  assert.equal(closedPeriods.body[0].status, "CERRADO");

  const reopenPeriod = await json(`${server.url}/api/catalog/periodos/${periods.body[0].id}/reabrir`, {
    method: "POST", headers, body: JSON.stringify({ responsible_id: responsible.id, notes: "Corrección autorizada" }),
  });
  assert.equal(reopenPeriod.response.status, 200);

  const original = await json(`${server.url}/api/catalog/versiones`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, exercise_id: exerciseId, code: "ORI-2028-1", name: "Original 2028", version_type: "ORIGINAL", responsible_id: responsible.id, notes: "Sin importes" }),
  });
  assert.equal(original.response.status, 201);

  const forecastTooEarly = await json(`${server.url}/api/catalog/versiones`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, exercise_id: exerciseId, code: "FC-INVALIDO", name: "Forecast inválido", version_type: "FORECAST", source_version_id: original.body.id }),
  });
  assert.equal(forecastTooEarly.response.status, 409);

  const approveOriginal = await json(`${server.url}/api/catalog/versiones/${original.body.id}/aprobar`, {
    method: "POST", headers, body: JSON.stringify({ responsible_id: responsible.id, notes: "Original aprobado" }),
  });
  assert.equal(approveOriginal.response.status, 200);

  const editApproved = await json(`${server.url}/api/catalog/versiones/${original.body.id}`, {
    method: "PATCH", headers, body: JSON.stringify({ name: "No debe cambiar" }),
  });
  assert.equal(editApproved.response.status, 409);

  const forecast = await json(`${server.url}/api/catalog/versiones`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: demo.id, exercise_id: exerciseId, period_id: periods.body[5].id, code: "FC-2028-1", name: "Forecast junio", version_type: "FORECAST", source_version_id: original.body.id, responsible_id: responsible.id }),
  });
  assert.equal(forecast.response.status, 201);

  const copied = await json(`${server.url}/api/catalog/versiones/${original.body.id}/copiar`, {
    method: "POST", headers,
    body: JSON.stringify({ code: "ORI-2028-2", name: "Original revisado", responsible_id: responsible.id, notes: "Copia de metadatos" }),
  });
  assert.equal(copied.response.status, 201);
  assert.equal(copied.body.version_number, 2);

  const approveCopy = await json(`${server.url}/api/catalog/versiones/${copied.body.id}/aprobar`, {
    method: "POST", headers, body: JSON.stringify({ responsible_id: responsible.id, notes: "Nueva versión aprobada" }),
  });
  assert.equal(approveCopy.response.status, 200);

  const replaceOriginal = await json(`${server.url}/api/catalog/versiones/${original.body.id}/reemplazar`, {
    method: "POST", headers,
    body: JSON.stringify({ responsible_id: responsible.id, notes: "Se adopta la revisión 2", replacement_version_id: copied.body.id }),
  });
  assert.equal(replaceOriginal.response.status, 200);

  const versions = await json(`${server.url}/api/catalog/versiones?company_id=${demo.id}&exercise_id=${exerciseId}`);
  assert.equal(versions.response.status, 200);
  assert.equal(versions.body.find((item) => item.id === original.body.id).status, "REEMPLAZADO");
  assert.equal(versions.body.find((item) => item.id === forecast.body.id).source_version_code, "ORI-2028-1");

  const history = await json(`${server.url}/api/catalog/versiones/${original.body.id}/historial`);
  assert.equal(history.response.status, 200);
  assert.ok(history.body.some((item) => item.to_status === "APROBADO"));
  assert.ok(history.body.some((item) => item.to_status === "REEMPLAZADO"));

  const migration = server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version = 4").get();
  assert.equal(migration.name, "multiperiodos_multiversiones_fase_3");
});

test("Fase 3 conserva datos al reiniciar la base local", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase3-persist-"));
  let server = await startServer({ port: 0, dataDir });
  const companies = await json(`${server.url}/api/catalog/empresas`);
  const demo = companies.body.find((item) => item.code === "DEMO");
  const exercises = await json(`${server.url}/api/catalog/ejercicios?company_id=${demo.id}`);
  assert.ok(exercises.body.some((item) => item.budget_year === 2027));
  await server.close();

  server = await startServer({ port: 0, dataDir });
  const reopened = await json(`${server.url}/api/catalog/ejercicios?company_id=${demo.id}`);
  assert.ok(reopened.body.some((item) => item.budget_year === 2027));
  const periods = await json(`${server.url}/api/catalog/periodos?company_id=${demo.id}&exercise_id=${reopened.body[0].id}`);
  assert.equal(periods.body.length, 12);
  await server.close();
  await rm(dataDir, { recursive: true, force: true });
});
