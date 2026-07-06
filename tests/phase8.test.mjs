import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };

async function call(server, method, route, body) {
  const response = await fetch(`${server.url}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, body: await response.json().catch(() => null) };
}
const get = (server, route) => call(server, "GET", route);
const post = (server, route, body) => call(server, "POST", route, body);
const patch = (server, route, body) => call(server, "PATCH", route, body);
const put = (server, route, body) => call(server, "PUT", route, body);

function qs(descriptor) {
  const params = new URLSearchParams({
    company_id: String(descriptor.company_id),
    exercise_id: String(descriptor.exercise_id),
    version_id: String(descriptor.version_id),
    source_type: descriptor.source_type,
  });
  if (descriptor.period_number) params.set("period_number", String(descriptor.period_number));
  return params.toString();
}

test("Fase 8 genera estados, análisis vertical/horizontal, ratios, Dupont, EVA y Excel", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase8-"));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { try { await server.close(); } catch {} await rm(dataDir, { recursive: true, force: true }); });

  const health = await get(server, "/api/health");
  assert.equal(health.body.phase, 8);
  assert.equal(health.body.version, "0.8.0");
  assert.equal(health.body.accessMode, "directo");
  assert.equal((await post(server, "/api/auth/login", {})).response.status, 404);

  const demo = (await get(server, "/api/catalog/empresas")).body.find((row) => row.code === "DEMO");
  const pen = (await get(server, "/api/catalog/monedas")).body.find((row) => row.code === "PEN");
  const unit = (await get(server, "/api/catalog/unidades")).body.find((row) => row.code === "UND");
  const responsible = (await get(server, `/api/catalog/responsables?company_id=${demo.id}`)).body[0];
  const site = (await get(server, `/api/catalog/sedes?company_id=${demo.id}`)).body[0];
  const baseAccount = (await get(server, `/api/catalog/cuentas?company_id=${demo.id}`)).body[0];

  const center = await post(server, "/api/catalog/centros", {
    company_id: demo.id, site_id: site.id, responsible_id: responsible.id,
    code: "PROD-F8", name: "Centro productivo F8", center_type: "PRODUCTIVO", active: true,
  });
  const exercise = await post(server, "/api/catalog/ejercicios", {
    company_id: demo.id, code: "EJ-2035", budget_year: 2035, currency_id: pen.id, active: true,
  });
  const original = await post(server, "/api/catalog/versiones", {
    company_id: demo.id, exercise_id: exercise.body.id, code: "ORI-2035",
    name: "Presupuesto original 2035", version_type: "ORIGINAL", responsible_id: responsible.id,
  });
  assert.equal(center.response.status, 201);
  assert.equal(exercise.response.status, 201);
  assert.equal(original.response.status, 201);
  const periods = (await get(server, `/api/catalog/periodos?company_id=${demo.id}&exercise_id=${exercise.body.id}`)).body;

  const product = await post(server, "/api/master-budget/items", { company_id: demo.id, code: "PROD-F8", name: "Producto F8", item_type: "PRODUCTO", unit_id: unit.id, active: true });
  const material = await post(server, "/api/master-budget/items", { company_id: demo.id, code: "MAT-F8", name: "Material F8", item_type: "MATERIAL", unit_id: unit.id, active: true });
  const masterBase = { company_id: demo.id, exercise_id: exercise.body.id, version_id: original.body.id, period_id: periods[0].id, center_id: center.body.id, account_id: baseAccount.id };
  assert.equal((await post(server, "/api/master-budget/sales", { ...masterBase, item_id: product.body.id, quantity: 100, unit_price: 10 })).response.status, 201);
  assert.equal((await post(server, "/api/master-budget/inventories", { ...masterBase, item_id: product.body.id, initial_quantity: 100, entries_quantity: 0, exits_quantity: 0, desired_final_quantity: 100, unit_cost: 1 })).response.status, 201);
  for (const cost of [
    { cost_category: "MATERIALES", quantity: 1, unit_cost: 400, item_id: material.body.id, behavior: "VARIABLE", traceability: "DIRECTO" },
    { cost_category: "MANO_OBRA", quantity: 1, unit_cost: 100, item_id: null, behavior: "VARIABLE", traceability: "DIRECTO" },
    { cost_category: "CIF", quantity: 1, unit_cost: 100, item_id: null, behavior: "FIJO", traceability: "INDIRECTO" },
  ]) assert.equal((await post(server, "/api/master-budget/costs", { ...masterBase, ...cost })).response.status, 201);
  assert.equal((await post(server, "/api/master-budget/expenses", { ...masterBase, behavior: "FIJO", traceability: "INDIRECTO", amount: 200 })).response.status, 201);
  assert.equal((await put(server, "/api/master-budget/settings", {
    company_id: demo.id, exercise_id: exercise.body.id, version_id: original.body.id,
    tax_rate: 30, collection_rate: 100, payment_rate: 100,
    opening_cash: 500, opening_receivables: 100, opening_ppe: 1000,
    opening_payables: 300, opening_debt: 400, notes: "Supuestos F8",
  })).response.status, 200);

  const group = await post(server, "/api/catalog/grupos", { company_id: demo.id, code: "FIN-F8", name: "Análisis financiero F8", active: true });
  const element = await post(server, "/api/catalog/elementos", { company_id: demo.id, group_id: group.body.id, code: "EF-F8", name: "Partidas financieras F8", active: true });
  const definitions = [
    ["VEN-F8", "Ventas", "INGRESO", "SALES", null, 1000, 1100],
    ["COS-F8", "Costo de ventas", "COSTO", "COST_OF_SALES", null, 600, 650],
    ["GAS-F8", "Gastos operativos", "GASTO", "OPERATING_EXPENSE", null, 200, 220],
    ["IMP-F8", "Impuesto", "GASTO", "INCOME_TAX", null, 60, 69],
    ["CAJ-F8", "Efectivo", "ACTIVO", "CURRENT_ASSET", "CASH", 200, 250],
    ["CXC-F8", "Cuentas por cobrar", "ACTIVO", "CURRENT_ASSET", "RECEIVABLES", 200, 200],
    ["INV-F8", "Inventarios", "ACTIVO", "CURRENT_ASSET", "INVENTORY", 100, 100],
    ["ANC-F8", "Activo no corriente", "ACTIVO", "NONCURRENT_ASSET", null, 500, 500],
    ["PCO-F8", "Pasivo corriente", "PASIVO", "CURRENT_LIABILITY", null, 300, 320],
    ["PNC-F8", "Pasivo no corriente", "PASIVO", "NONCURRENT_LIABILITY", null, 200, 200],
    ["PAT-F8", "Patrimonio", "PATRIMONIO", "EQUITY", null, 500, 530],
  ];
  const financialAccounts = [];
  for (const [code, name, nature, section, role, budget, actual] of definitions) {
    const account = await post(server, "/api/catalog/cuentas", {
      company_id: demo.id, element_id: element.body.id, code, name, nature, movement_type: "DETALLE", active: true,
    });
    assert.equal(account.response.status, 201);
    financialAccounts.push({ id: account.body.id, code, section, role, budget, actual });
  }

  for (const account of financialAccounts) {
    const line = await post(server, "/api/budget-original/lines", {
      company_id: demo.id, exercise_id: exercise.body.id, version_id: original.body.id,
      center_id: center.body.id, account_id: account.id, currency_id: pen.id,
      responsible_id: responsible.id, source: "Supuesto presupuestal F8",
    });
    assert.equal(line.response.status, 201);
    const detail = await get(server, `/api/budget-original/lines/${line.body.id}`);
    assert.equal((await patch(server, `/api/budget-original/lines/${line.body.id}`, {
      monthly_values: detail.body.monthly_values.map((row) => ({ period_id: row.period_id, budgeted_value: account.budget, real_value: null })),
    })).response.status, 200);
  }

  const mapping = await put(server, "/api/financial-analysis/mappings", {
    company_id: demo.id,
    mappings: financialAccounts.map((account) => ({
      account_id: account.id, statement_section: account.section, ratio_role: account.role, notes: "Clasificación explícita de prueba F8",
    })),
  });
  assert.equal(mapping.response.status, 200);
  assert.equal(mapping.body.updated, financialAccounts.length);

  const originalDescriptor = { company_id: demo.id, exercise_id: exercise.body.id, version_id: original.body.id, source_type: "ORIGINAL", period_number: 1 };
  let originalReport = await get(server, `/api/financial-analysis/report?${qs(originalDescriptor)}`);
  assert.equal(originalReport.response.status, 200);
  assert.equal(originalReport.body.income_statement.sales, 1000);
  assert.equal(originalReport.body.income_statement.cost_of_sales, 600);
  assert.equal(originalReport.body.income_statement.gross_profit, 400);
  assert.equal(originalReport.body.income_statement.operating_income, 200);
  assert.equal(originalReport.body.income_statement.net_income, 140);
  assert.equal(originalReport.body.balance_sheet.balanced, true);
  assert.equal(originalReport.body.vertical_analysis.find((row) => row.key === "sales").percentage, 100);
  assert.equal(originalReport.body.eva.eva, null);

  const assumptions = await put(server, "/api/financial-analysis/assumptions", {
    ...originalDescriptor,
    tax_rate: 30,
    cost_of_capital_rate: 10,
    invested_capital_override: null,
    source_reference: "Supuestos académicos documentados para prueba F8",
    notes: "WACC demostrativo",
  });
  assert.equal(assumptions.response.status, 200);
  originalReport = await get(server, `/api/financial-analysis/report?${qs(originalDescriptor)}`);
  assert.equal(originalReport.body.eva.nopat, 140);
  assert.notEqual(originalReport.body.eva.eva, null);
  assert.equal(originalReport.body.dupont.roe, 14);
  assert.ok(originalReport.body.ratios.some((ratio) => ratio.category === "LIQUIDEZ"));
  assert.ok(originalReport.body.ratios.some((ratio) => ratio.name === "ROE"));

  assert.equal((await post(server, "/api/budget-original/approve", {
    company_id: demo.id, exercise_id: exercise.body.id, version_id: original.body.id,
    responsible_id: responsible.id, notes: "Aprobación para forecast F8",
  })).response.status, 200);

  for (const account of financialAccounts) {
    const actual = await post(server, "/api/actuals", {
      company_id: demo.id, exercise_id: exercise.body.id, original_version_id: original.body.id,
      period_id: periods[0].id, center_id: center.body.id, account_id: account.id,
      budget_type: "PRESUPUESTO_ORIGINAL", actual_value: account.actual,
      source_type: "REAL_INTERNO", source_reference: `Cierre real ${account.code}`,
      source_period: "2035-01", source_date: "2035-01-31", responsible_id: responsible.id,
    });
    assert.equal(actual.response.status, 201);
  }

  const realDescriptor = { company_id: demo.id, exercise_id: exercise.body.id, version_id: original.body.id, source_type: "REAL", period_number: 1 };
  assert.equal((await put(server, "/api/financial-analysis/assumptions", {
    ...realDescriptor, tax_rate: 30, cost_of_capital_rate: 10, invested_capital_override: null,
    source_reference: "Tasas documentadas para la información real", notes: null,
  })).response.status, 200);
  const realReport = await get(server, `/api/financial-analysis/report?${qs(realDescriptor)}`);
  assert.equal(realReport.response.status, 200);
  assert.equal(realReport.body.income_statement.sales, 1100);
  assert.equal(realReport.body.income_statement.net_income, 161);
  assert.equal(realReport.body.balance_sheet.total_assets, 1050);
  assert.equal(realReport.body.balance_sheet.total_liabilities_and_equity, 1050);
  assert.equal(realReport.body.balance_sheet.balanced, true);
  assert.equal(realReport.body.ratios.find((ratio) => ratio.name === "Liquidez corriente").result, 1.72);
  assert.equal(realReport.body.dupont.roe, 30.38);
  assert.notEqual(realReport.body.eva.eva, null);
  assert.ok(realReport.body.sources.some((source) => source.includes("Cierre real")));

  const forecast = await post(server, "/api/forecasts", {
    company_id: demo.id, exercise_id: exercise.body.id, original_version_id: original.body.id,
    cutoff_period_number: 1, code: "FC-2035-F8", name: "Forecast F8",
    responsible_id: responsible.id, observation: "Forecast con corte enero para análisis F8",
  });
  assert.equal(forecast.response.status, 201);
  const forecastDescriptor = { company_id: demo.id, exercise_id: exercise.body.id, version_id: forecast.body.id, source_type: "FORECAST", period_number: null };
  const forecastReport = await get(server, `/api/financial-analysis/report?${qs(forecastDescriptor)}`);
  assert.equal(forecastReport.response.status, 200);
  assert.equal(forecastReport.body.income_statement.sales, 12100);
  assert.equal(forecastReport.body.balance_sheet.balanced, true);
  assert.equal(forecastReport.body.context.source_type, "FORECAST");

  const horizontal = await post(server, "/api/financial-analysis/horizontal", { initial: originalDescriptor, final: realDescriptor });
  assert.equal(horizontal.response.status, 200);
  const salesComparison = horizontal.body.rows.find((row) => row.statement === "RESULTADOS" && row.key === "sales");
  assert.equal(salesComparison.initial_value, 1000);
  assert.equal(salesComparison.final_value, 1100);
  assert.equal(salesComparison.monetary_difference, 100);
  assert.equal(salesComparison.percentage_variation, 10);

  const zeroRatioDescriptor = { ...realDescriptor, period_number: 2 };
  const missingReal = await get(server, `/api/financial-analysis/report?${qs(zeroRatioDescriptor)}`);
  assert.equal(missingReal.response.status, 409);

  const exported = await fetch(`${server.url}/api/financial-analysis/export?${qs(realDescriptor)}`);
  assert.equal(exported.status, 200);
  assert.match(String(exported.headers.get("content-type")), /spreadsheetml/);
  const bytes = Buffer.from(await exported.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  assert.ok(bytes.length > 5000);

  const otherCompany = await post(server, "/api/catalog/empresas", {
    code: "OTR8", commercial_name: "Otra empresa F8", legal_name: "Otra Empresa F8 S.A.C.",
    tax_id: "20999999998", sector: "Servicios", currency_id: pen.id, active: true,
  });
  assert.equal(otherCompany.response.status, 201);
  const invalidContext = await get(server, `/api/financial-analysis/report?company_id=${otherCompany.body.id}&exercise_id=${exercise.body.id}&version_id=${original.body.id}&source_type=ORIGINAL`);
  assert.equal(invalidContext.response.status, 400);

  assert.equal(server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=9").get().name, "estados_y_analisis_financiero_fase_8");

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persisted = await get(server, `/api/financial-analysis/report?${qs(realDescriptor)}`);
  assert.equal(persisted.body.balance_sheet.balanced, true);
  assert.notEqual(persisted.body.eva.eva, null);
});
