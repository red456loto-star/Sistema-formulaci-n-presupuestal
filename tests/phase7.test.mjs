import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };

async function call(server, method, route, body) {
  const response = await fetch(`${server.url}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  return { response, body: result };
}
const get = (server, route) => call(server, "GET", route);
const post = (server, route, body) => call(server, "POST", route, body);
const patch = (server, route, body) => call(server, "PATCH", route, body);

async function createActualWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Informacion real");
  sheet.addRow(["Periodo", "Centro", "Cuenta", "Tipo presupuesto", "Presupuestado", "Real", "Tipo fuente", "Fuente", "Periodo fuente", "Fecha fuente", "Responsable", "Comentario"]);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}

test("Fase 7 registra/importa reales y crea múltiples forecast con corte, aprobación y persistencia", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase7-"));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => {
    try { await server.close(); } catch {}
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await get(server, "/api/health");
  assert.ok(health.body.phase >= 7);
  assert.match(health.body.version, /^0\.(?:7|8)\./);
  assert.equal(health.body.accessMode, "directo");
  assert.equal((await post(server, "/api/auth/login", {})).response.status, 404);

  const demo = (await get(server, "/api/catalog/empresas")).body.find((row) => row.code === "DEMO");
  const pen = (await get(server, "/api/catalog/monedas")).body.find((row) => row.code === "PEN");
  const responsible = (await get(server, `/api/catalog/responsables?company_id=${demo.id}`)).body[0];
  const center = (await get(server, `/api/catalog/centros?company_id=${demo.id}`)).body[0];
  const account = (await get(server, `/api/catalog/cuentas?company_id=${demo.id}`)).body[0];
  assert.ok(demo && pen && responsible && center && account);

  const exercise = await post(server, "/api/catalog/ejercicios", {
    company_id: demo.id,
    code: "EJ-2033",
    budget_year: 2033,
    currency_id: pen.id,
    active: true,
  });
  assert.equal(exercise.response.status, 201);
  const original = await post(server, "/api/catalog/versiones", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    code: "ORI-2033",
    name: "Presupuesto original 2033",
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
    responsible_id: responsible.id,
    source: "Supuesto presupuestal de prueba",
  });
  assert.equal(line.response.status, 201);
  let detail = await get(server, `/api/budget-original/lines/${line.body.id}`);
  const monthly = detail.body.monthly_values.map((row, index) => ({
    period_id: row.period_id,
    budgeted_value: 1000 + index * 100,
    real_value: null,
  }));
  assert.equal((await patch(server, `/api/budget-original/lines/${line.body.id}`, { monthly_values: monthly })).response.status, 200);
  assert.equal((await post(server, "/api/budget-original/approve", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    version_id: original.body.id,
    responsible_id: responsible.id,
    notes: "Presupuesto original aprobado para forecast",
  })).response.status, 200);

  const periods = (await get(server, `/api/catalog/periodos?company_id=${demo.id}&exercise_id=${exercise.body.id}`)).body;
  for (let index = 0; index < 2; index += 1) {
    const actual = await post(server, "/api/actuals", {
      company_id: demo.id,
      exercise_id: exercise.body.id,
      original_version_id: original.body.id,
      period_id: periods[index].id,
      center_id: center.id,
      account_id: account.id,
      budget_type: "PRESUPUESTO_ORIGINAL",
      actual_value: 900 + index * 100,
      source_type: "REAL_INTERNO",
      source_reference: `Cierre contable mes ${index + 1}`,
      source_period: `2033-${String(index + 1).padStart(2, "0")}`,
      source_date: `2033-${String(index + 1).padStart(2, "0")}-28`,
      responsible_id: responsible.id,
    });
    assert.equal(actual.response.status, 201);
  }

  const duplicate = await post(server, "/api/actuals", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    original_version_id: original.body.id,
    period_id: periods[0].id,
    center_id: center.id,
    account_id: account.id,
    budget_type: "PRESUPUESTO_ORIGINAL",
    actual_value: 999,
    source_type: "REAL_INTERNO",
    source_reference: "Duplicado",
  });
  assert.equal(duplicate.response.status, 409);

  const workbookBase64 = await createActualWorkbook([
    [3, center.code, account.code, "PRESUPUESTO_ORIGINAL", "", 1100, "REAL_PUBLICADO", "Estado financiero público marzo", "2033-03", "2033-03-31", responsible.code, "Importado"],
    [4, "CENTRO-INEXISTENTE", account.code, "PRESUPUESTO_ORIGINAL", "", 1200, "REAL_INTERNO", "Fila inválida", "2033-04", "2033-04-30", responsible.code, "Debe rechazarse"],
  ]);
  const inspection = await post(server, "/api/actuals/import/inspect", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    original_version_id: original.body.id,
    file_name: "reales.xlsx",
    content_base64: workbookBase64,
  });
  assert.equal(inspection.response.status, 200);
  assert.equal(inspection.body.summary.rows_read, 2);
  assert.equal(inspection.body.summary.rows_valid, 1);
  assert.equal(inspection.body.summary.rows_rejected, 1);

  const validRows = inspection.body.rows.filter((row) => row.status === "VALIDO").map(({ row_number, status, errors, period_label, center_label, account_label, ...row }) => row);
  const confirmed = await post(server, "/api/actuals/import/confirm", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    original_version_id: original.body.id,
    file_name: "reales.xlsx",
    sheet_name: inspection.body.sheet_name,
    operator_text: "Analista de prueba",
    rows: validRows,
  });
  assert.equal(confirmed.response.status, 201);
  assert.equal(confirmed.body.created, 1);

  const actuals = await get(server, `/api/actuals?company_id=${demo.id}&exercise_id=${exercise.body.id}&original_version_id=${original.body.id}`);
  assert.equal(actuals.body.length, 3);
  assert.deepEqual(actuals.body.map((row) => row.actual_value), [900, 1000, 1100]);
  assert.equal(actuals.body[0].budgeted_value, 1000);
  assert.equal(actuals.body[0].variance, -100);

  const forecast1 = await post(server, "/api/forecasts", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    original_version_id: original.body.id,
    cutoff_period_number: 3,
    code: "FC-2033-R1",
    name: "Forecast revisión 1",
    responsible_id: responsible.id,
    observation: "Corte al mes de marzo",
  });
  assert.equal(forecast1.response.status, 201);
  assert.equal(forecast1.body.revision_number, 1);

  let forecastDetail = await get(server, `/api/forecasts/${forecast1.body.id}`);
  assert.equal(forecastDetail.body.rows.length, 12);
  assert.deepEqual(forecastDetail.body.rows.slice(0, 3).map((row) => row.value_origin), ["REAL", "REAL", "REAL"]);
  assert.ok(forecastDetail.body.rows.slice(3).every((row) => row.value_origin === "PROYECCION"));
  assert.deepEqual(forecastDetail.body.rows.slice(0, 3).map((row) => row.forecast_value), [900, 1000, 1100]);

  const realLine = forecastDetail.body.rows[0];
  assert.equal((await patch(server, `/api/forecasts/${forecast1.body.id}/lines/${realLine.id}`, {
    projected_value: 9999,
    source_reference: "No debe permitirse",
  })).response.status, 409);

  const futureLine = forecastDetail.body.rows.find((row) => row.period_number === 4);
  assert.equal((await patch(server, `/api/forecasts/${forecast1.body.id}/lines/${futureLine.id}`, {
    projected_value: 1500,
    source_reference: "Proyección comercial revisada",
    responsible_id: responsible.id,
    comment: "Ajuste por nueva demanda",
  })).response.status, 200);
  forecastDetail = await get(server, `/api/forecasts/${forecast1.body.id}`);
  assert.equal(forecastDetail.body.rows.find((row) => row.period_number === 4).forecast_value, 1500);

  const annualOriginal = monthly.reduce((sum, row) => sum + row.budgeted_value, 0);
  const expectedForecast = 900 + 1000 + 1100 + 1500 + monthly.slice(4).reduce((sum, row) => sum + row.budgeted_value, 0);
  assert.equal(forecastDetail.body.summary.annual.original_budget, annualOriginal);
  assert.equal(forecastDetail.body.summary.annual.forecast_value, expectedForecast);
  assert.equal(forecastDetail.body.summary.annual.difference, expectedForecast - annualOriginal);

  const approved = await post(server, `/api/forecasts/${forecast1.body.id}/approve`, {
    responsible_id: responsible.id,
    observation: "Forecast final aprobado",
  });
  assert.equal(approved.response.status, 200);
  assert.equal((await patch(server, `/api/forecasts/${forecast1.body.id}/lines/${futureLine.id}`, {
    projected_value: 1600,
    source_reference: "No debe cambiar",
  })).response.status, 409);

  const forecast2 = await post(server, "/api/forecasts", {
    company_id: demo.id,
    exercise_id: exercise.body.id,
    original_version_id: original.body.id,
    cutoff_period_number: 2,
    code: "FC-2033-R2",
    name: "Forecast revisión 2",
    responsible_id: responsible.id,
    observation: "Segunda revisión con corte febrero",
  });
  assert.equal(forecast2.response.status, 201);
  assert.equal(forecast2.body.revision_number, 2);

  const list = await get(server, `/api/forecasts?company_id=${demo.id}&exercise_id=${exercise.body.id}`);
  assert.equal(list.body.length, 2);
  assert.deepEqual(list.body.map((row) => row.revision_number), [2, 1]);

  const otherCompany = await post(server, "/api/catalog/empresas", {
    code: "OTR7",
    commercial_name: "Otra empresa F7",
    legal_name: "Otra Empresa F7 S.A.C.",
    tax_id: "20999999997",
    sector: "Servicios",
    currency_id: pen.id,
    active: true,
  });
  assert.equal(otherCompany.response.status, 201);
  const separated = await get(server, `/api/forecasts?company_id=${otherCompany.body.id}&exercise_id=${exercise.body.id}`);
  assert.equal(separated.response.status, 400);

  assert.equal(server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=8").get().name, "informacion_real_forecast_fase_7");

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persistedActuals = await get(server, `/api/actuals?company_id=${demo.id}&exercise_id=${exercise.body.id}&original_version_id=${original.body.id}`);
  const persistedForecast = await get(server, `/api/forecasts/${forecast1.body.id}`);
  assert.equal(persistedActuals.body.length, 3);
  assert.equal(persistedForecast.body.version.status, "APROBADO");
  assert.equal(persistedForecast.body.summary.annual.forecast_value, expectedForecast);
});
