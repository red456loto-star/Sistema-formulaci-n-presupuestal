import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };

async function request(server, method, route, body) {
  const response = await fetch(`${server.url}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, body: await response.json().catch(() => null) };
}

async function context(server, company, currency, responsible, year, suffix) {
  const exercise = await request(server, "POST", "/api/catalog/ejercicios", {
    company_id: company.id, code: `EJ-${suffix}`, budget_year: year, currency_id: currency.id, active: true,
  });
  const version = await request(server, "POST", "/api/catalog/versiones", {
    company_id: company.id, exercise_id: exercise.body.id, code: `ORI-${suffix}`,
    name: `Original ${suffix}`, version_type: "ORIGINAL", responsible_id: responsible.id,
  });
  await request(server, "PUT", "/api/master-budget/settings", {
    company_id: company.id, exercise_id: exercise.body.id, version_id: version.body.id,
    tax_rate: 0, collection_rate: 100, payment_rate: 100,
    opening_cash: 100, opening_receivables: 0, opening_ppe: 0,
    opening_payables: 0, opening_debt: 0, notes: "Prueba F8.1",
  });
  return {
    company_id: company.id, exercise_id: exercise.body.id, version_id: version.body.id,
    source_type: "ORIGINAL", period_number: null,
  };
}

function query(value) {
  return new URLSearchParams({
    company_id: String(value.company_id), exercise_id: String(value.exercise_id),
    version_id: String(value.version_id), source_type: value.source_type,
  }).toString();
}

test("Fase 8.1 corrige mapeos, EVA, monedas y Excel horizontal", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pc-f81-"));
  const server = await startServer({ port: 0, dataDir });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });

  const health = await request(server, "GET", "/api/health");
  assert.equal(health.body.version, "0.8.1");

  const company = (await request(server, "GET", "/api/catalog/empresas")).body.find((row) => row.code === "DEMO");
  const currencies = (await request(server, "GET", "/api/catalog/monedas")).body;
  const pen = currencies.find((row) => row.code === "PEN");
  const usd = currencies.find((row) => row.code === "USD");
  const responsible = (await request(server, "GET", `/api/catalog/responsables?company_id=${company.id}`)).body[0];
  const account = (await request(server, "GET", `/api/catalog/cuentas?company_id=${company.id}`)).body[0];

  await request(server, "PUT", "/api/financial-analysis/mappings", {
    company_id: company.id,
    mappings: [{ account_id: account.id, statement_section: "SALES", ratio_role: null, notes: null }],
  });
  const removed = await request(server, "PUT", "/api/financial-analysis/mappings", {
    company_id: company.id,
    mappings: [{ account_id: account.id, statement_section: null, ratio_role: null, notes: null }],
  });
  assert.equal(removed.body.removed, 1);
  const mappings = await request(server, "GET", `/api/financial-analysis/mappings?company_id=${company.id}`);
  assert.equal(mappings.body.find((row) => row.account_id === account.id).statement_section, null);

  const penDescriptor = await context(server, company, pen, responsible, 2036, "2036-PEN");
  let report = await request(server, "GET", `/api/financial-analysis/report?${query(penDescriptor)}`);
  assert.equal(report.body.context.currency_code, "PEN");
  assert.equal(report.body.eva.eva, null);
  assert.equal(report.body.complete, false);

  await request(server, "PUT", "/api/financial-analysis/assumptions", {
    ...penDescriptor, tax_rate: 0, cost_of_capital_rate: 10, invested_capital_override: null,
    source_reference: "Supuesto documentado F8.1", notes: null,
  });
  report = await request(server, "GET", `/api/financial-analysis/report?${query(penDescriptor)}`);
  assert.equal(report.body.eva.eva, -10);
  assert.equal(report.body.complete, true);

  const usdDescriptor = await context(server, company, usd, responsible, 2037, "2037-USD");
  const mixed = await request(server, "POST", "/api/financial-analysis/horizontal", {
    initial: penDescriptor, final: usdDescriptor,
  });
  assert.equal(mixed.response.status, 400);
  assert.match(mixed.body.message, /monedas distintas/i);

  const horizontal = await request(server, "POST", "/api/financial-analysis/horizontal", {
    initial: penDescriptor, final: penDescriptor,
  });
  assert.equal(horizontal.response.status, 200);
  assert.equal(horizontal.body.initial.currency_code, "PEN");

  const exported = await fetch(`${server.url}/api/financial-analysis/horizontal/export`, {
    method: "POST", headers, body: JSON.stringify({ initial: penDescriptor, final: penDescriptor }),
  });
  assert.equal(exported.status, 200);
  const bytes = Buffer.from(await exported.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
});
