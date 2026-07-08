import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { seedPhase9 } from "./phase9-fixture.mjs";

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

function context(ids, periodId, budgetTypeId) {
  return {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    period_id: periodId,
    version_id: ids.originalVersionId,
    budget_type_id: budgetTypeId,
  };
}

function row(values) {
  return {
    center_code: "C-F9-A",
    center_name: "Centro A",
    element_code: "EL-F9",
    element_name: "Elemento F9",
    account_code: null,
    account_name: values.line_name,
    account_nature: values.account_nature,
    line_code: values.financial_item,
    line_name: values.line_name,
    statement_section: values.statement_section ?? "ESTADO_RESULTADOS",
    financial_item: values.financial_item,
    cost_behavior: values.cost_behavior ?? "NO_APLICA",
    cost_traceability: values.cost_traceability ?? "NO_APLICA",
    quantity: null,
    unit_price: null,
    amount: values.amount,
    source_reference: "Fixture sintético Fase 11",
    notes: "Dato demostrativo no oficial",
  };
}

function financialRows(kind) {
  const actual = kind === "REAL";
  return [
    row({ line_name: "Ventas", account_nature: "INGRESO", financial_item: "SALES", amount: actual ? 920 : 1000 }),
    row({ line_name: "Costo de ventas", account_nature: "COSTO", financial_item: "COST_OF_SALES", amount: actual ? 560 : 500, cost_behavior: "VARIABLE", cost_traceability: "DIRECTO" }),
    row({ line_name: "Gastos operativos", account_nature: "GASTO", financial_item: "OPERATING_EXPENSES", amount: actual ? 230 : 200, cost_behavior: "FIJO", cost_traceability: "INDIRECTO" }),
    row({ line_name: "Utilidad operativa", account_nature: "INGRESO", financial_item: "OPERATING_INCOME", amount: actual ? 130 : 300 }),
    row({ line_name: "Resultado antes de impuestos", account_nature: "INGRESO", financial_item: "PRE_TAX_INCOME", amount: actual ? 120 : 280 }),
    row({ line_name: "Impuesto a la renta", account_nature: "GASTO", financial_item: "INCOME_TAX", amount: actual ? 36 : 84 }),
    row({ line_name: "Resultado neto", account_nature: "INGRESO", financial_item: "NET_INCOME", amount: actual ? 84 : 196 }),
    row({ line_name: "Efectivo", account_nature: "ACTIVO", financial_item: "CASH", statement_section: "ESTADO_SITUACION", amount: actual ? 180 : 200 }),
    row({ line_name: "Inventarios", account_nature: "ACTIVO", financial_item: "INVENTORY", statement_section: "ESTADO_SITUACION", amount: actual ? 140 : 100 }),
    row({ line_name: "Activos corrientes", account_nature: "ACTIVO", financial_item: "CURRENT_ASSETS", statement_section: "ESTADO_SITUACION", amount: actual ? 650 : 700 }),
    row({ line_name: "Activos no corrientes", account_nature: "ACTIVO", financial_item: "NONCURRENT_ASSETS", statement_section: "ESTADO_SITUACION", amount: actual ? 850 : 800 }),
    row({ line_name: "Total activos", account_nature: "ACTIVO", financial_item: "TOTAL_ASSETS", statement_section: "ESTADO_SITUACION", amount: 1500 }),
    row({ line_name: "Pasivos corrientes", account_nature: "PASIVO", financial_item: "CURRENT_LIABILITIES", statement_section: "ESTADO_SITUACION", amount: actual ? 420 : 400 }),
    row({ line_name: "Pasivos no corrientes", account_nature: "PASIVO", financial_item: "NONCURRENT_LIABILITIES", statement_section: "ESTADO_SITUACION", amount: actual ? 220 : 200 }),
    row({ line_name: "Total pasivos", account_nature: "PASIVO", financial_item: "TOTAL_LIABILITIES", statement_section: "ESTADO_SITUACION", amount: actual ? 640 : 600 }),
    row({ line_name: "Patrimonio", account_nature: "PATRIMONIO", financial_item: "EQUITY", statement_section: "ESTADO_SITUACION", amount: actual ? 860 : 900 }),
  ];
}

function importBody(ids, periodId, budgetTypeId, dataKind, rows, extra = {}) {
  return {
    ...context(ids, periodId, budgetTypeId),
    data_kind: dataKind,
    source_file: `${dataKind.toLowerCase()}-fase11.xlsx`,
    source_label: "Fuente demostrativa Fase 11",
    source_url: "https://example.test/fixture",
    source_period: "2041-01",
    operator_name: "Responsable de prueba",
    wacc_rate: 10,
    notes: "Información sintética para pruebas automatizadas",
    replace_existing: false,
    rows,
    ...extra,
  };
}

test("Fase 11 aplica la jerarquía, datos maestros, análisis, reportes, propuestas y correo", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pc-phase11-"));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => {
    delete process.env.PRESUCONTROL_MAIL_TEST_MODE;
    try { await server.close(); } catch {}
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await call(server, "GET", "/api/health");
  assert.deepEqual([health.body.version, health.body.phase, health.body.accessMode], ["0.11.0", 11, "directo"]);
  assert.equal((await call(server, "POST", "/api/auth/login", {})).response.status, 404);
  assert.equal(server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=12").get().name, "correcciones_jerarquia_datos_maestros_fase_11");

  const ids = seedPhase9(server.database);
  const period = server.database.connection.prepare("SELECT id FROM budget_periods WHERE exercise_id=? AND period_number=1").get(ids.exerciseId);
  const budgetTypes = await call(server, "GET", `/api/phase11/budget-types?company_id=${ids.companyId}`);
  assert.equal(budgetTypes.response.status, 200);
  assert.ok(budgetTypes.body.length >= 10);
  const budgetTypeId = budgetTypes.body.find((item) => item.code === "COSTOS").id;
  const ctx = context(ids, period.id, budgetTypeId);
  const query = new URLSearchParams(Object.entries(ctx).map(([key, value]) => [key, String(value)])).toString();

  const before = await call(server, "GET", `/api/phase11/workflow-status?${query}`);
  assert.equal(before.response.status, 200);
  assert.equal(before.body.context_ready, true);
  assert.equal(before.body.master_data_ready, false);
  assert.equal(before.body.next_required, "TABLAS_MAESTRAS");

  const template = await call(server, "GET", "/api/phase11/master-data/template");
  assert.equal(template.response.status, 200);
  assert.ok(template.body.file_name.endsWith(".xlsx"));
  assert.ok(Buffer.from(template.body.content_base64, "base64").length > 5000);
  const inspected = await call(server, "POST", "/api/phase11/master-data/inspect", {
    file_name: template.body.file_name,
    content_base64: template.body.content_base64,
  });
  assert.equal(inspected.response.status, 200);
  assert.ok(inspected.body.summary.rows_valid >= 1);

  const budgeted = await call(server, "POST", "/api/phase11/master-data/import", importBody(ids, period.id, budgetTypeId, "PRESUPUESTADO", financialRows("PRESUPUESTADO")));
  assert.equal(budgeted.response.status, 201);
  assert.equal(budgeted.body.created, 16);
  const real = await call(server, "POST", "/api/phase11/master-data/import", importBody(ids, period.id, budgetTypeId, "REAL", financialRows("REAL")));
  assert.equal(real.response.status, 201);
  assert.equal(real.body.created, 16);

  const duplicate = await call(server, "POST", "/api/phase11/master-data/import", importBody(ids, period.id, budgetTypeId, "REAL", [financialRows("REAL")[0]], { source_file: "otro-real.xlsx" }));
  assert.equal(duplicate.response.status, 409);
  assert.match(duplicate.body.message, /Ya existe información real/i);

  const append = await call(server, "POST", "/api/phase11/master-data/import", {
    ...importBody(ids, period.id, budgetTypeId, "PRESUPUESTADO", [row({ line_name: "Partida manual adicional", account_nature: "GASTO", financial_item: null, statement_section: "PRESUPUESTO", amount: 25, cost_behavior: "FIJO", cost_traceability: "INDIRECTO" })]),
    source_file: null,
  });
  assert.equal(append.response.status, 201);
  assert.match(append.body.message, /agregada/i);
  assert.equal(append.body.created, 17);

  const status = await call(server, "GET", `/api/phase11/workflow-status?${query}`);
  assert.equal(status.body.master_data_ready, true);
  assert.equal(status.body.budgeted_ready, true);
  assert.equal(status.body.real_ready, true);
  assert.equal(status.body.comparison_ready, true);
  assert.ok(status.body.counts.financial_rows > 0);
  assert.ok(status.body.counts.cost_rows > 0);

  const registered = await call(server, "GET", `/api/phase11/master-data?${query}`);
  assert.equal(registered.response.status, 200);
  assert.equal(registered.body.datasets.length, 2);
  assert.equal(registered.body.rows.length, 33);
  const editable = registered.body.rows.find((item) => item.line_name === "Partida manual adicional");
  const updated = await call(server, "PATCH", `/api/phase11/master-data/rows/${editable.id}`, { amount: 30, notes: "Editada en prueba" });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.amount, 30);
  const deleted = await call(server, "DELETE", `/api/phase11/master-data/rows/${editable.id}`);
  assert.equal(deleted.response.status, 200);

  const analysis = await call(server, "GET", `/api/phase11/analysis?${query}`);
  assert.equal(analysis.response.status, 200);
  assert.equal(analysis.body.status.comparison_ready, true);
  assert.ok(analysis.body.financial.vertical.length > 0);
  assert.ok(analysis.body.financial.horizontal.length > 0);
  assert.ok(analysis.body.financial.ratios.length >= 7);
  assert.notEqual(analysis.body.financial.dupont.roe, null);
  assert.notEqual(analysis.body.financial.eva.eva, null);
  assert.ok(analysis.body.costs.summary.total > 0);
  assert.ok(analysis.body.variations.rows.some((item) => item.status === "DESFAVORABLE"));
  assert.ok(analysis.body.dashboard.critical_items.length > 0);

  for (const kind of ["FINANCIAL", "COSTS", "VARIATIONS", "DASHBOARD"]) {
    const excel = await fetch(`${server.url}/api/phase11/reports/excel`, { method: "POST", headers, body: JSON.stringify({ ...ctx, kind }) });
    assert.equal(excel.status, 200, `${kind} Excel`);
    const bytes = Buffer.from(await excel.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
    const pdf = await fetch(`${server.url}/api/phase11/reports/pdf`, { method: "POST", headers, body: JSON.stringify({ ...ctx, kind }) });
    assert.equal(pdf.status, 200, `${kind} PDF`);
    const pdfBytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(pdfBytes.subarray(0, 4).toString(), "%PDF");
  }

  const suggestions = await call(server, "POST", "/api/phase11/proposals/suggestions", ctx);
  assert.equal(suggestions.response.status, 200);
  assert.ok(suggestions.body.length > 0);
  const suggestion = suggestions.body[0];
  const proposal = await call(server, "POST", "/api/phase11/proposals", {
    ...ctx,
    center_id: suggestion.center_id,
    element_id: suggestion.element_id,
    account_id: suggestion.account_id,
    problem: suggestion.problem,
    evidence_value: suggestion.evidence_value,
    evidence_unit: suggestion.evidence_unit,
    evidence_text: suggestion.evidence_text,
    probable_cause: suggestion.probable_cause,
    proposed_action: suggestion.proposed_action,
    expected_impact: suggestion.expected_impact,
    profitability_impact: suggestion.profitability_impact,
    responsible_id: suggestion.responsible_id,
    priority: suggestion.priority,
    due_date: suggestion.due_date,
    status: "PROPUESTA",
  });
  assert.equal(proposal.response.status, 201);
  assert.equal(proposal.body.status, "PROPUESTA");
  const approvedProposal = await call(server, "PATCH", `/api/phase11/proposals/${proposal.body.id}`, { status: "APROBADA" });
  assert.equal(approvedProposal.response.status, 200);
  assert.equal(approvedProposal.body.status, "APROBADA");
  const proposalReport = await fetch(`${server.url}/api/phase11/reports/pdf`, { method: "POST", headers, body: JSON.stringify({ ...ctx, kind: "PROPOSALS" }) });
  assert.equal(proposalReport.status, 200);

  process.env.PRESUCONTROL_MAIL_TEST_MODE = "success";
  const sent = await call(server, "POST", "/api/phase10/email/send", {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    version_id: ids.originalVersionId,
    center_id: ids.centerA,
    period_number: 1,
    smtp: { host: "smtp.example.test", port: 587, secure: false, username: "mailer@example.test", password: "session-only", from_name: "PresuControl", from_email: "mailer@example.test" },
  });
  assert.equal(sent.response.status, 201);
  assert.equal(sent.body.status, "ENVIADO");
  assert.ok(sent.body.attachment_name.endsWith(".pdf"));

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persisted = await call(server, "GET", `/api/phase11/proposals?${query}`);
  assert.equal(persisted.body.length, 1);
  assert.equal(persisted.body[0].status, "APROBADA");
  const persistedMaster = await call(server, "GET", `/api/phase11/master-data?${query}`);
  assert.equal(persistedMaster.body.datasets.length, 2);
  assert.equal(persistedMaster.body.rows.length, 32);
});
