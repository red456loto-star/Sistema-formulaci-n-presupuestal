import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };
const call = async (server, method, route, body) => {
  const response = await fetch(`${server.url}${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { response, body: await response.json().catch(() => null) };
};
const get = (server, route) => call(server, "GET", route);
const post = (server, route, body) => call(server, "POST", route, body);
const patch = (server, route, body) => call(server, "PATCH", route, body);
const put = (server, route, body) => call(server, "PUT", route, body);

test("Fase 6 integra presupuesto maestro y estados balanceados", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pc-f6-"));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { try { await server.close(); } catch {} await rm(dataDir, { recursive: true, force: true }); });

  const health = await get(server, "/api/health");
  assert.equal(health.body.phase, 6);
  assert.equal(health.body.version, "0.6.0");
  assert.equal((await post(server, "/api/auth/login", {})).response.status, 404);

  const demo = (await get(server, "/api/catalog/empresas")).body.find((x) => x.code === "DEMO");
  const pen = (await get(server, "/api/catalog/monedas")).body.find((x) => x.code === "PEN");
  const unit = (await get(server, "/api/catalog/unidades")).body.find((x) => x.code === "UND");
  const resp = (await get(server, `/api/catalog/responsables?company_id=${demo.id}`)).body[0];
  const site = (await get(server, `/api/catalog/sedes?company_id=${demo.id}`)).body[0];
  const account = (await get(server, `/api/catalog/cuentas?company_id=${demo.id}`)).body[0];

  const center = await post(server, "/api/catalog/centros", { company_id: demo.id, site_id: site.id, responsible_id: resp.id, code: "PROD-01", name: "Planta", center_type: "PRODUCTIVO", active: true });
  const exercise = await post(server, "/api/catalog/ejercicios", { company_id: demo.id, code: "EJ-2032", budget_year: 2032, currency_id: pen.id, active: true });
  const version = await post(server, "/api/catalog/versiones", { company_id: demo.id, exercise_id: exercise.body.id, code: "ORI-2032-M", name: "Maestro 2032", version_type: "ORIGINAL", responsible_id: resp.id });
  assert.equal(center.response.status, 201);
  assert.equal(exercise.response.status, 201);
  assert.equal(version.response.status, 201);
  const periods = (await get(server, `/api/catalog/periodos?company_id=${demo.id}&exercise_id=${exercise.body.id}`)).body;

  const product = await post(server, "/api/master-budget/items", { company_id: demo.id, code: "PROD-A", name: "Producto A", item_type: "PRODUCTO", unit_id: unit.id, active: true });
  const material = await post(server, "/api/master-budget/items", { company_id: demo.id, code: "MAT-A", name: "Material A", item_type: "MATERIAL", unit_id: unit.id, active: true });
  const base = { company_id: demo.id, exercise_id: exercise.body.id, version_id: version.body.id, period_id: periods[0].id, center_id: center.body.id, account_id: account.id };

  const sale = await post(server, "/api/master-budget/sales", { ...base, item_id: product.body.id, quantity: 100, unit_price: 10 });
  assert.equal(sale.response.status, 201);
  const inventory = await post(server, "/api/master-budget/inventories", { ...base, item_id: product.body.id, initial_quantity: 20, entries_quantity: 100, exits_quantity: 100, desired_final_quantity: 30, unit_cost: 4 });
  assert.equal(inventory.response.status, 201);
  assert.equal((await post(server, "/api/master-budget/inventories", { ...base, item_id: material.body.id, initial_quantity: 0, entries_quantity: 0, exits_quantity: 1, desired_final_quantity: 0, unit_cost: 1 })).response.status, 400);

  const production = await get(server, `/api/master-budget/production?company_id=${demo.id}&exercise_id=${exercise.body.id}&version_id=${version.body.id}`);
  assert.equal(production.body[0].production_required, 110);

  const purchase = await post(server, "/api/master-budget/purchases", { ...base, item_id: material.body.id, needs_quantity: 200, initial_inventory_quantity: 50, desired_final_quantity: 30, unit_price: 2 });
  assert.equal(purchase.response.status, 201);
  const purchases = await get(server, `/api/master-budget/purchases?company_id=${demo.id}&exercise_id=${exercise.body.id}&version_id=${version.body.id}`);
  assert.equal(purchases.body[0].purchase_quantity, 180);
  assert.equal(purchases.body[0].purchase_total, 360);

  for (const cost of [
    { cost_category: "MATERIALES", quantity: 100, unit_cost: 2, item_id: material.body.id, behavior: "VARIABLE", traceability: "DIRECTO" },
    { cost_category: "MANO_OBRA", quantity: 50, unit_cost: 3, item_id: null, behavior: "VARIABLE", traceability: "DIRECTO" },
    { cost_category: "CIF", quantity: 1, unit_cost: 100, item_id: null, behavior: "FIJO", traceability: "INDIRECTO" },
  ]) assert.equal((await post(server, "/api/master-budget/costs", { ...base, ...cost })).response.status, 201);

  assert.equal((await post(server, "/api/master-budget/expenses", { ...base, behavior: "FIJO", traceability: "INDIRECTO", amount: 100 })).response.status, 201);
  assert.equal((await post(server, "/api/master-budget/investments", { ...base, description: "Equipo", amount: 1200, useful_life_months: 12, financing_source: "DEUDA" })).response.status, 201);
  assert.equal((await put(server, "/api/master-budget/settings", { company_id: demo.id, exercise_id: exercise.body.id, version_id: version.body.id, tax_rate: 30, collection_rate: 80, payment_rate: 70, opening_cash: 5000, opening_receivables: 0, opening_ppe: 10000, opening_payables: 1000, opening_debt: 2000 })).response.status, 200);

  const qs = `company_id=${demo.id}&exercise_id=${exercise.body.id}&version_id=${version.body.id}`;
  const sales = await get(server, `/api/master-budget/sales?${qs}`);
  assert.equal(sales.body[0].sale_amount, 1000);
  const income = await get(server, `/api/master-budget/income-statement?${qs}`);
  assert.equal(income.body.monthly[0].production_cost, 450);
  assert.equal(income.body.monthly[0].net_income, 245);
  const balance = await get(server, `/api/master-budget/balance-sheet?${qs}`);
  assert.equal(balance.body.annual.balanced, true);
  assert.equal(balance.body.annual.total_assets, balance.body.annual.total_liabilities_and_equity);
  const summary = await get(server, `/api/master-budget/summary?${qs}`);
  assert.deepEqual([summary.body.sales_total, summary.body.purchases_total, summary.body.production_units, summary.body.production_cost], [1000, 360, 110, 450]);

  const exported = await fetch(`${server.url}/api/master-budget/export/all?${qs}`);
  assert.equal(exported.status, 200);
  const bytes = Buffer.from(await exported.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  assert.ok(bytes.length > 5000);

  assert.equal((await post(server, `/api/catalog/periodos/${periods[0].id}/cerrar`, { responsible_id: resp.id, notes: "Cierre" })).response.status, 200);
  assert.equal((await patch(server, `/api/master-budget/sales/${sale.body.id}`, { quantity: 120 })).response.status, 409);
  assert.equal((await post(server, `/api/catalog/versiones/${version.body.id}/aprobar`, { responsible_id: resp.id, notes: "Aprobado" })).response.status, 200);
  assert.equal((await post(server, "/api/master-budget/expenses", { ...base, period_id: periods[1].id, behavior: "FIJO", traceability: "INDIRECTO", amount: 10 })).response.status, 409);
  assert.equal(server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=7").get().name, "presupuesto_maestro_fase_6");

  await server.close();
  server = await startServer({ port: 0, dataDir });
  assert.equal((await get(server, `/api/master-budget/summary?${qs}`)).body.balance_ok, true);
});
