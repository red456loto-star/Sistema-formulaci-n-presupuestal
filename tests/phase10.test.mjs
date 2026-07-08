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

function reportBody(ids, reportType, extra = {}) {
  return {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    version_id: ids.originalVersionId,
    report_type: reportType,
    period_number: null,
    center_id: null,
    responsible_id: null,
    ...extra,
  };
}

function smtp() {
  return {
    host: "smtp.example.test",
    port: 587,
    secure: false,
    username: "mailer@example.test",
    password: "session-only-secret",
    from_name: "PresuControl Test",
    from_email: "mailer@example.test",
  };
}

test("Fase 10 valida reportes, PDF, Excel, correo pendiente, reintento y propuestas", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pc-phase10-"));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => {
    delete process.env.PRESUCONTROL_FORCE_OFFLINE;
    delete process.env.PRESUCONTROL_MAIL_TEST_MODE;
    try { await server.close(); } catch {}
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await call(server, "GET", "/api/health");
  assert.deepEqual([health.body.version, health.body.phase, health.body.accessMode], ["0.10.0", 10, "directo"]);
  assert.equal((await call(server, "POST", "/api/auth/login", {})).response.status, 404);
  assert.equal(server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=11").get().name, "reportes_correo_propuestas_fase_10");

  const ids = seedPhase9(server.database);
  const responsible = server.database.connection.prepare("SELECT id,email FROM responsibles WHERE company_id=? LIMIT 1").get(ids.companyId);

  const options = await call(server, "GET", `/api/phase10/options?company_id=${ids.companyId}&exercise_id=${ids.exerciseId}`);
  assert.equal(options.response.status, 200);
  assert.ok(options.body.approved_versions.some((row) => row.id === ids.originalVersionId));
  assert.ok(options.body.centers.some((row) => row.id === ids.centerA && row.responsible_email));

  const variations = await call(server, "POST", "/api/phase10/reports/preview", reportBody(ids, "VARIANCES"));
  assert.equal(variations.response.status, 200);
  assert.equal(variations.body.report_type, "VARIANCES");
  assert.equal(variations.body.rows.length, 5);
  assert.ok(variations.body.columns.some((column) => column.key === "monetary_variation"));
  assert.equal(variations.body.context.company_id, ids.companyId);

  const centers = await call(server, "POST", "/api/phase10/reports/preview", reportBody(ids, "CENTERS", { center_id: ids.centerB }));
  assert.equal(centers.response.status, 200);
  assert.equal(centers.body.rows.length, 1);
  assert.equal(centers.body.rows[0].center_id, ids.centerB);

  const master = await call(server, "POST", "/api/phase10/reports/preview", reportBody(ids, "MASTER"));
  assert.equal(master.response.status, 200);
  assert.equal(master.body.report_type, "MASTER");
  assert.equal(master.body.rows.length, 12);

  const excel = await fetch(`${server.url}/api/phase10/reports/excel`, { method: "POST", headers, body: JSON.stringify(reportBody(ids, "VARIANCES")) });
  assert.equal(excel.status, 200);
  assert.match(String(excel.headers.get("content-type")), /spreadsheetml/);
  const excelBytes = Buffer.from(await excel.arrayBuffer());
  assert.equal(excelBytes.subarray(0, 2).toString(), "PK");
  assert.ok(excelBytes.length > 8000);

  const pdf = await fetch(`${server.url}/api/phase10/reports/pdf`, { method: "POST", headers, body: JSON.stringify(reportBody(ids, "VARIANCES")) });
  assert.equal(pdf.status, 200);
  assert.match(String(pdf.headers.get("content-type")), /application\/pdf/);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdfBytes.length > 1500);

  const suggestions = await call(server, "POST", "/api/phase10/proposals/suggestions", {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    version_id: ids.originalVersionId,
    period_number: null,
    center_id: null,
  });
  assert.equal(suggestions.response.status, 200);
  assert.ok(suggestions.body.length >= 1);
  const suggestion = suggestions.body[0];
  assert.ok(Number(suggestion.evidence_value) > 0);
  assert.ok(String(suggestion.evidence_text).length > 10);
  assert.ok(suggestion.proposed_action);
  assert.ok(suggestion.responsible_id);

  const invalidProposal = await call(server, "POST", "/api/phase10/proposals", {
    ...suggestion,
    evidence_text: "",
  });
  assert.equal(invalidProposal.response.status, 400);

  const createdProposal = await call(server, "POST", "/api/phase10/proposals", {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    period_id: suggestion.period_id,
    version_id: ids.originalVersionId,
    center_id: suggestion.center_id,
    element_id: suggestion.element_id,
    account_id: suggestion.account_id,
    source_type: suggestion.source_type,
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
  assert.equal(createdProposal.response.status, 201);
  assert.equal(createdProposal.body.status, "PROPUESTA");
  assert.equal(createdProposal.body.account_id, suggestion.account_id);

  const updatedProposal = await call(server, "PATCH", `/api/phase10/proposals/${createdProposal.body.id}`, { status: "APROBADA" });
  assert.equal(updatedProposal.response.status, 200);
  assert.equal(updatedProposal.body.status, "APROBADA");
  const proposalList = await call(server, "GET", `/api/phase10/proposals?company_id=${ids.companyId}&exercise_id=${ids.exerciseId}&version_id=${ids.originalVersionId}`);
  assert.equal(proposalList.response.status, 200);
  assert.equal(proposalList.body.length, 1);

  const proposalReport = await call(server, "POST", "/api/phase10/reports/preview", reportBody(ids, "PROPOSALS"));
  assert.equal(proposalReport.response.status, 200);
  assert.equal(proposalReport.body.rows.length, 1);
  assert.equal(proposalReport.body.rows[0].status, "APROBADA");

  const savedSmtp = await call(server, "PUT", "/api/phase10/smtp-settings", {
    company_id: ids.companyId,
    smtp: { ...smtp(), password: undefined },
  });
  assert.equal(savedSmtp.response.status, 200);
  const loadedSmtp = await call(server, "GET", `/api/phase10/smtp-settings?company_id=${ids.companyId}`);
  assert.equal(loadedSmtp.response.status, 200);
  assert.equal(loadedSmtp.body.host, smtp().host);
  assert.equal(Object.hasOwn(loadedSmtp.body, "password"), false);

  process.env.PRESUCONTROL_FORCE_OFFLINE = "1";
  const queued = await call(server, "POST", "/api/phase10/email/send", {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    version_id: ids.originalVersionId,
    center_id: ids.centerA,
    period_number: null,
    smtp: smtp(),
  });
  assert.equal(queued.response.status, 201);
  assert.equal(queued.body.status, "PENDIENTE");
  assert.match(queued.body.message, /pendiente/i);
  assert.ok(queued.body.attachment_name.endsWith(".pdf"));

  const attachment = await fetch(`${server.url}/api/phase10/email/${queued.body.id}/attachment`);
  assert.equal(attachment.status, 200);
  const attachmentBytes = Buffer.from(await attachment.arrayBuffer());
  assert.equal(attachmentBytes.subarray(0, 4).toString(), "%PDF");

  const pendingRetry = await call(server, "POST", `/api/phase10/email/${queued.body.id}/retry`, { smtp: smtp() });
  assert.equal(pendingRetry.response.status, 200);
  assert.equal(pendingRetry.body.status, "PENDIENTE");
  assert.equal(pendingRetry.body.retry_count, 1);

  delete process.env.PRESUCONTROL_FORCE_OFFLINE;
  process.env.PRESUCONTROL_MAIL_TEST_MODE = "success";
  const sent = await call(server, "POST", `/api/phase10/email/${queued.body.id}/retry`, { smtp: smtp() });
  assert.equal(sent.response.status, 200);
  assert.equal(sent.body.status, "ENVIADO");
  assert.equal(sent.body.retry_count, 2);
  assert.ok(sent.body.sent_at);

  const draftSend = await call(server, "POST", "/api/phase10/email/send", {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    version_id: ids.forecastVersionId,
    center_id: ids.centerA,
    period_number: null,
    smtp: smtp(),
  });
  assert.equal(draftSend.response.status, 409);
  assert.match(draftSend.body.message, /aprobada|cerrada/i);

  server.database.connection.prepare("UPDATE responsibles SET email='correo-invalido' WHERE id=?").run(responsible.id);
  const invalidRecipient = await call(server, "POST", "/api/phase10/email/send", {
    company_id: ids.companyId,
    exercise_id: ids.exerciseId,
    version_id: ids.originalVersionId,
    center_id: ids.centerB,
    period_number: null,
    smtp: smtp(),
  });
  assert.equal(invalidRecipient.response.status, 400);
  assert.match(invalidRecipient.body.message, /correo válido/i);
  server.database.connection.prepare("UPDATE responsibles SET email=? WHERE id=?").run(responsible.email, responsible.id);

  const history = await call(server, "GET", `/api/phase10/email-history?company_id=${ids.companyId}&exercise_id=${ids.exerciseId}`);
  assert.equal(history.response.status, 200);
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].status, "ENVIADO");
  assert.equal(history.body[0].retry_count, 2);

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persistedProposals = await call(server, "GET", `/api/phase10/proposals?company_id=${ids.companyId}&exercise_id=${ids.exerciseId}&version_id=${ids.originalVersionId}`);
  const persistedHistory = await call(server, "GET", `/api/phase10/email-history?company_id=${ids.companyId}&exercise_id=${ids.exerciseId}`);
  assert.equal(persistedProposals.body.length, 1);
  assert.equal(persistedProposals.body[0].status, "APROBADA");
  assert.equal(persistedHistory.body.length, 1);
  assert.equal(persistedHistory.body[0].status, "ENVIADO");
});
