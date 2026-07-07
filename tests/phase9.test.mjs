import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { phase9Body, seedPhase9 } from "./phase9-fixture.mjs";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };

async function call(server, method, route, body) {
  const response = await fetch(`${server.url}${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, body: await response.json().catch(() => null) };
}

test("Fase 9 calcula variaciones, relevancia, dashboard, filtros, Excel y persistencia", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pc-phase9-"));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { try { await server.close(); } catch {} await rm(dataDir, { recursive: true, force: true }); });

  const health = await call(server, "GET", "/api/health");
  assert.deepEqual([health.body.version, health.body.phase, health.body.accessMode], ["0.9.0", 9, "directo"]);
  assert.equal((await call(server, "POST", "/api/auth/login", {})).response.status, 404);
  const ids = seedPhase9(server.database);
  assert.equal(server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=10").get().name, "variaciones_relevancia_dashboard_fase_9");

  const options = await call(server, "GET", `/api/phase9/options?company_id=${ids.companyId}&exercise_id=${ids.exerciseId}`);
  assert.equal(options.response.status, 200);
  assert.ok(options.body.centers.some((row) => row.id === ids.centerA));
  assert.ok(options.body.forecast_versions.some((row) => row.id === ids.forecastVersionId && row.original_version_id === ids.originalVersionId));
  assert.ok(options.body.budget_types.some((row) => row.budget_type === "PRESUPUESTO_ORIGINAL"));

  const result = await call(server, "POST", "/api/phase9/analyze", phase9Body(ids));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.context.base_label, "Presupuesto original");
  assert.equal(result.body.context.comparison_label, "Información real");
  const summary = result.body.variations.summary;
  assert.deepEqual([summary.base_value, summary.comparison_value, summary.monetary_variation], [1700, 1920, 220]);
  assert.deepEqual([summary.percentage_variation, summary.execution_percentage, summary.participation_total], [12.94, 112.94, 100]);
  assert.deepEqual([summary.favorable_count, summary.unfavorable_count, summary.coverage_percentage], [2, 3, 100]);

  const sales = result.body.variations.rows.find((row) => row.account_id === ids.accounts.sales);
  assert.deepEqual([sales.monetary_variation, sales.percentage_variation, sales.execution_percentage, sales.status], [100, 10, 110, "FAVORABLE"]);
  const fixedCost = result.body.variations.rows.find((row) => row.account_id === ids.accounts.fixed);
  assert.deepEqual([fixedCost.monetary_variation, fixedCost.percentage_variation, fixedCost.status], [60, 15, "DESFAVORABLE"]);
  const zeroBase = result.body.variations.rows.find((row) => row.account_id === ids.accounts.zero);
  assert.deepEqual([zeroBase.monetary_variation, zeroBase.percentage_variation, zeroBase.execution_percentage, zeroBase.material], [50, null, null, true]);

  assert.equal(result.body.variations.trend.length, 12);
  assert.equal(result.body.variations.trend[0].monetary_variation, 220);
  assert.equal(result.body.variations.trend[0].comparison_available, true);
  assert.equal(result.body.variations.centers[0].id, ids.centerB);
  assert.equal(result.body.dashboard.critical_centers[0].unfavorable_impact, 80);
  assert.ok(result.body.dashboard.critical_accounts.length >= 5);
  assert.ok(Array.isArray(result.body.dashboard.cost_participation));

  const relevance = result.body.relevance;
  assert.deepEqual([relevance.summary.base_value, relevance.summary.comparison_value, relevance.summary.monetary_variation, relevance.summary.result_impact], [700, 770, 70, -70]);
  assert.equal(relevance.behavior.find((row) => row.code === "FIJO").base_value, 500);
  assert.equal(relevance.behavior.find((row) => row.code === "FIJO").monetary_variation, 90);
  assert.equal(relevance.behavior.find((row) => row.code === "VARIABLE").monetary_variation, -20);
  assert.ok(relevance.traceability.some((row) => row.code === "DIRECTO"));
  assert.ok(relevance.traceability.some((row) => row.code === "INDIRECTO"));
  assert.ok(relevance.centers.some((row) => row.id === ids.centerA));
  assert.ok(relevance.elements.some((row) => row.id === ids.elementId));

  const centerFiltered = await call(server, "POST", "/api/phase9/analyze", phase9Body(ids, "ORIGINAL_REAL", { center_id: ids.centerB }));
  assert.equal(centerFiltered.response.status, 200);
  assert.equal(centerFiltered.body.variations.rows.length, 2);
  assert.equal(centerFiltered.body.variations.summary.monetary_variation, 80);
  assert.ok(centerFiltered.body.variations.rows.every((row) => row.center_id === ids.centerB));

  const accountFiltered = await call(server, "POST", "/api/phase9/analyze", phase9Body(ids, "ORIGINAL_REAL", {
    group_id: ids.groupId, element_id: ids.elementId, account_id: ids.accounts.sales,
  }));
  assert.equal(accountFiltered.response.status, 200);
  assert.equal(accountFiltered.body.variations.rows.length, 1);
  assert.equal(accountFiltered.body.variations.rows[0].account_id, ids.accounts.sales);

  const originalForecast = await call(server, "POST", "/api/phase9/analyze", phase9Body(ids, "ORIGINAL_FORECAST"));
  const forecastSales = originalForecast.body.variations.rows.find((row) => row.account_id === ids.accounts.sales);
  assert.deepEqual([forecastSales.base_value, forecastSales.comparison_value, forecastSales.monetary_variation], [1000, 1050, 50]);
  const forecastReal = await call(server, "POST", "/api/phase9/analyze", phase9Body(ids, "FORECAST_REAL"));
  const forecastRealSales = forecastReal.body.variations.rows.find((row) => row.account_id === ids.accounts.sales);
  assert.deepEqual([forecastRealSales.base_value, forecastRealSales.comparison_value, forecastRealSales.monetary_variation], [1050, 1100, 50]);
  assert.equal((await call(server, "POST", "/api/phase9/analyze", phase9Body(ids, "ORIGINAL_FORECAST", { forecast_version_id: null }))).response.status, 400);

  const exported = await fetch(`${server.url}/api/phase9/export`, {
    method: "POST", headers, body: JSON.stringify(phase9Body(ids)),
  });
  assert.equal(exported.status, 200);
  assert.match(String(exported.headers.get("content-type")), /spreadsheetml/);
  assert.match(String(exported.headers.get("content-disposition")), /variaciones-dashboard-ORI-F9-original-real\.xlsx/);
  const bytes = Buffer.from(await exported.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  assert.ok(bytes.length > 8000);

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persisted = await call(server, "POST", "/api/phase9/analyze", phase9Body(ids));
  assert.equal(persisted.response.status, 200);
  assert.deepEqual([persisted.body.variations.summary.monetary_variation, persisted.body.relevance.summary.base_value], [220, 700]);
});
