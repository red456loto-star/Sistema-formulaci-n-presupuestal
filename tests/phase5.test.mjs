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
  return { response, body: await response.json() };
}

function post(server, route, body) {
  return json(`${server.url}${route}`, { method: "POST", headers, body: JSON.stringify(body) });
}

function patch(server, route, body) {
  return json(`${server.url}${route}`, { method: "PATCH", headers, body: JSON.stringify(body) });
}

test("Fase 5 registra meses, totales, proyecciones, variación comparable, aprobación y bloqueo", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase5-"));
  let server = await startServer({ port: 0, dataDir });
  context.after(async () => {
    try { await server.close(); } catch {}
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await json(`${server.url}/api/health`);
  assert.equal(health.body.phase, 5);
  assert.equal(health.body.version, "0.5.1");
  assert.equal(health.body.accessMode, "directo");
  assert.equal((await post(server, "/api/auth/login", {})).response.status, 404);

  const companies = await json(`${server.url}/api/catalog/empresas`);
  const demo = companies.body.find((item) => item.code === "DEMO");
  const pen = (await json(`${server.url}/api/catalog/monedas`)).body.find((item) => item.code === "PEN");
  const unit = (await json(`${server.url}/api/catalog/unidades`)).body[0];
  const responsible = (await json(`${server.url}/api/catalog/responsables?company_id=${demo.id}`)).body[0];
  const center = (await json(`${server.url}/api/catalog/centros?company_id=${demo.id}`)).body[0];
  const account = (await json(`${server.url}/api/catalog/cuentas?company_id=${demo.id}`)).body[0];
  assert.ok(demo && pen && responsible && center && account);

  const exercise = await post(server, "/api/catalog/ejercicios", {
    company_id: demo.id,
    code: "EJ-2030",
    budget_year: 2030,
    currency_id: pen.id,
    active: true,
  });
  assert.equal(exercise.response.status, 201);

  const original = await post(server, "/api/catalog/versiones", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    code: "ORI-2030-1",
    name: "Presupuesto original 2030",
    version_type: "ORIGINAL",
    responsible_id: responsible.id,
  });
  assert.equal(original.response.status, 201);

  const line = await post(server, "/api/budget-original/lines", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    version_id: original.body.id,
    center_id: center.id,
    account_id: account.id,
    currency_id: pen.id,
    unit_id: unit?.id ?? null,
    responsible_id: responsible.id,
    comment: "Supuesto presupuestal de prueba",
    support: "Sustento académico",
    source: "Dato demostrativo",
  });
  assert.equal(line.response.status, 201);

  let detail = await json(`${server.url}/api/budget-original/lines/${line.body.id}`);
  assert.equal(detail.body.monthly_values.length, 12);
  assert.equal(detail.body.projections.length, 3);
  assert.equal(detail.body.annual_budgeted, 0);
  assert.equal(detail.body.annual_real, null);
  assert.equal(detail.body.annual_comparable_budget, null);
  assert.equal(detail.body.annual_variance, null);

  const monthly = detail.body.monthly_values.map((item, index) => ({
    period_id: item.period_id,
    budgeted_value: (index + 1) * 100,
    real_value: index === 0 ? 90 : null,
  }));
  const edited = await patch(server, `/api/budget-original/lines/${line.body.id}`, {
    monthly_values: monthly,
    projections: detail.body.projections.map((item, index) => ({
      projection_year_id: item.projection_year_id,
      budgeted_value: 10000 + index * 1000,
      real_value: null,
    })),
  });
  assert.equal(edited.response.status, 200);

  detail = await json(`${server.url}/api/budget-original/lines/${line.body.id}`);
  assert.equal(detail.body.annual_budgeted, 7800);
  assert.equal(detail.body.annual_real, 90);
  assert.equal(detail.body.annual_comparable_budget, 100);
  assert.equal(detail.body.annual_variance, -10);

  const distributed = await post(server, `/api/budget-original/lines/${line.body.id}/distribute`, {
    annual_total: 12000,
  });
  assert.equal(distributed.response.status, 200);
  detail = await json(`${server.url}/api/budget-original/lines/${line.body.id}`);
  assert.equal(detail.body.annual_budgeted, 12000);
  assert.equal(detail.body.monthly_values.reduce((sum, item) => sum + item.budgeted_value, 0), 12000);
  assert.equal(detail.body.annual_real, 90);
  assert.equal(detail.body.annual_comparable_budget, 1000);
  assert.equal(detail.body.annual_variance, -910);

  const projected = await post(server, `/api/budget-original/lines/${line.body.id}/project`, {
    rates: [10, 5, 5],
  });
  assert.equal(projected.response.status, 200);
  detail = await json(`${server.url}/api/budget-original/lines/${line.body.id}`);
  assert.deepEqual(detail.body.projections.map((item) => item.budgeted_value), [13200, 13860, 14553]);

  const secondCenter = await post(server, "/api/catalog/centros", {
    company_id: demo.id,
    site_id: center.site_id,
    responsible_id: responsible.id,
    code: "ADM-2",
    name: "Administración secundaria",
    center_type: "APOYO",
    active: true,
  });
  assert.equal(secondCenter.response.status, 201);

  const secondLine = await post(server, "/api/budget-original/lines", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    version_id: original.body.id,
    center_id: secondCenter.body.id,
    account_id: account.id,
    currency_id: pen.id,
    responsible_id: responsible.id,
  });
  assert.equal(secondLine.response.status, 201);

  const copied = await post(server, `/api/budget-original/lines/${secondLine.body.id}/copy`, {
    source_line_id: line.body.id,
    include_real: false,
  });
  assert.equal(copied.response.status, 200);
  const copiedDetail = await json(`${server.url}/api/budget-original/lines/${secondLine.body.id}`);
  assert.equal(copiedDetail.body.annual_budgeted, 12000);
  assert.equal(copiedDetail.body.annual_real, null);
  assert.equal(copiedDetail.body.annual_comparable_budget, null);
  assert.equal(copiedDetail.body.annual_variance, null);

  const periods = await json(`${server.url}/api/catalog/periodos?company_id=${demo.id}&exercise_id=${exercise.body.id}`);
  const closed = await post(server, `/api/catalog/periodos/${periods.body[0].id}/cerrar`, {
    responsible_id: responsible.id,
    notes: "Cierre de prueba",
  });
  assert.equal(closed.response.status, 200);

  const blockedPeriod = await patch(server, `/api/budget-original/lines/${line.body.id}`, {
    monthly_values: [{ period_id: periods.body[0].id, budgeted_value: 9999, real_value: null }],
  });
  assert.equal(blockedPeriod.response.status, 409);

  const summary = await json(`${server.url}/api/budget-original/summary?company_id=${demo.id}&exercise_id=${exercise.body.id}&version_id=${original.body.id}`);
  assert.equal(summary.body.line_count, 2);
  assert.equal(summary.body.total_budgeted, 24000);
  assert.equal(summary.body.total_real, 90);
  assert.equal(summary.body.comparable_budget, 1000);
  assert.equal(summary.body.variance, -910);
  assert.equal(summary.body.can_approve, true);

  const approved = await post(server, "/api/budget-original/approve", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    version_id: original.body.id,
    responsible_id: responsible.id,
    notes: "Aprobación del presupuesto original",
  });
  assert.equal(approved.response.status, 200);

  const blockedVersion = await patch(server, `/api/budget-original/lines/${line.body.id}`, {
    comment: "No debe cambiar",
  });
  assert.equal(blockedVersion.response.status, 409);

  const otherCompany = await post(server, "/api/catalog/empresas", {
    code: "OTR",
    commercial_name: "Otra empresa",
    legal_name: "Otra Empresa S.A.C.",
    tax_id: "20999999992",
    sector: "Servicios",
    currency_id: pen.id,
    active: true,
  });
  const otherSite = await post(server, "/api/catalog/sedes", {
    company_id: otherCompany.body.id,
    code: "OTR-S",
    name: "Otra sede",
    country: "Perú",
    active: true,
  });
  const otherResponsible = await post(server, "/api/catalog/responsables", {
    company_id: otherCompany.body.id,
    code: "OTR-R",
    full_name: "Otra persona",
    position: "Jefatura",
    email: "otra@empresa.local",
    active: true,
  });
  const otherCenter = await post(server, "/api/catalog/centros", {
    company_id: otherCompany.body.id,
    site_id: otherSite.body.id,
    responsible_id: otherResponsible.body.id,
    code: "OTR-C",
    name: "Otro centro",
    center_type: "APOYO",
    active: true,
  });
  const mixed = await post(server, "/api/budget-original/lines", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    version_id: original.body.id,
    center_id: otherCenter.body.id,
    account_id: account.id,
    currency_id: pen.id,
  });
  assert.equal(mixed.response.status, 409);

  assert.equal(
    server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=6").get().name,
    "presupuesto_original_fase_5",
  );

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persisted = await json(`${server.url}/api/budget-original/lines/${line.body.id}`);
  assert.equal(persisted.body.annual_budgeted, 12000);
  assert.equal(persisted.body.annual_comparable_budget, 1000);
  assert.equal(persisted.body.annual_variance, -910);
  assert.equal(persisted.body.projections.length, 3);
});
