import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };
const request = async (server, method, route, body) => {
  const response = await fetch(`${server.url}${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { response, body: await response.json() };
};
const get = (server, route) => request(server, "GET", route);
const post = (server, route, body) => request(server, "POST", route, body);
const patch = (server, route, body) => request(server, "PATCH", route, body);

test("Fase 5 permanece operativa dentro de la Fase 6", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase5-regression-"));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { try { await server.close(); } catch {} await rm(dataDir, { recursive: true, force: true }); });

  const health = await get(server, "/api/health");
  assert.ok(health.body.phase >= 5);
  assert.equal(health.body.accessMode, "directo");
  assert.equal((await post(server, "/api/auth/login", {})).response.status, 404);

  const demo = (await get(server, "/api/catalog/empresas")).body.find((row) => row.code === "DEMO");
  const pen = (await get(server, "/api/catalog/monedas")).body.find((row) => row.code === "PEN");
  const responsible = (await get(server, `/api/catalog/responsables?company_id=${demo.id}`)).body[0];
  const center = (await get(server, `/api/catalog/centros?company_id=${demo.id}`)).body[0];
  const account = (await get(server, `/api/catalog/cuentas?company_id=${demo.id}`)).body[0];

  const exercise = await post(server, "/api/catalog/ejercicios", {
    company_id: demo.id, code: "EJ-2030", budget_year: 2030, currency_id: pen.id, active: true,
  });
  const version = await post(server, "/api/catalog/versiones", {
    company_id: demo.id, exercise_id: exercise.body.id, code: "ORI-2030-1",
    name: "Presupuesto original 2030", version_type: "ORIGINAL", responsible_id: responsible.id,
  });
  const line = await post(server, "/api/budget-original/lines", {
    company_id: demo.id, exercise_id: exercise.body.id, version_id: version.body.id,
    center_id: center.id, account_id: account.id, currency_id: pen.id,
    responsible_id: responsible.id, comment: "Prueba regresiva",
  });
  assert.equal(line.response.status, 201);

  let detail = await get(server, `/api/budget-original/lines/${line.body.id}`);
  assert.equal(detail.body.monthly_values.length, 12);
  assert.equal(detail.body.projections.length, 3);

  const edited = await patch(server, `/api/budget-original/lines/${line.body.id}`, {
    monthly_values: detail.body.monthly_values.map((row, index) => ({
      period_id: row.period_id, budgeted_value: (index + 1) * 100, real_value: index === 0 ? 90 : null,
    })),
    projections: detail.body.projections.map((row, index) => ({
      projection_year_id: row.projection_year_id, budgeted_value: 10000 + index * 1000, real_value: null,
    })),
  });
  assert.equal(edited.response.status, 200);

  detail = await get(server, `/api/budget-original/lines/${line.body.id}`);
  assert.equal(detail.body.annual_budgeted, 7800);
  assert.equal(detail.body.annual_real, 90);
  assert.equal(detail.body.annual_comparable_budget, 100);
  assert.equal(detail.body.annual_variance, -10);

  assert.equal((await post(server, `/api/budget-original/lines/${line.body.id}/distribute`, { annual_total: 12000 })).response.status, 200);
  assert.equal((await post(server, `/api/budget-original/lines/${line.body.id}/project`, { rates: [10, 5, 5] })).response.status, 200);
  detail = await get(server, `/api/budget-original/lines/${line.body.id}`);
  assert.equal(detail.body.annual_budgeted, 12000);
  assert.deepEqual(detail.body.projections.map((row) => row.budgeted_value), [13200, 13860, 14553]);

  const summary = await get(server, `/api/budget-original/summary?company_id=${demo.id}&exercise_id=${exercise.body.id}&version_id=${version.body.id}`);
  assert.equal(summary.body.can_approve, true);
  assert.equal((await post(server, "/api/budget-original/approve", {
    company_id: demo.id, exercise_id: exercise.body.id, version_id: version.body.id,
    responsible_id: responsible.id, notes: "Aprobación de prueba",
  })).response.status, 200);
  assert.equal((await patch(server, `/api/budget-original/lines/${line.body.id}`, { comment: "No debe cambiar" })).response.status, 409);

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persisted = await get(server, `/api/budget-original/lines/${line.body.id}`);
  assert.equal(persisted.body.annual_budgeted, 12000);
  assert.equal(persisted.body.annual_variance, -910);
});
