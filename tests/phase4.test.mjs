import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import ExcelJS from "exceljs";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");
const headers = { "Content-Type": "application/json" };

async function json(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json();
  return { response, body };
}

async function workbookBase64(sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(columns);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}

async function inspect(server, fileName, content) {
  return json(`${server.url}/api/import/inspect`, { method: "POST", headers, body: JSON.stringify({ file_name: fileName, content_base64: content }) });
}

async function analyze(server, payload) {
  return json(`${server.url}/api/import/analyze`, { method: "POST", headers, body: JSON.stringify(payload) });
}

async function confirm(server, payload) {
  return json(`${server.url}/api/import/confirm`, { method: "POST", headers, body: JSON.stringify(payload) });
}

test("Fase 4 inspecciona, valida, importa, actualiza y documenta Excel sin login", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase4-"));
  const server = await startServer({ port: 0, dataDir });
  context.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });

  const health = await json(`${server.url}/api/health`);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.phase, 4);
  assert.equal(health.body.version, "0.4.0");
  assert.equal(health.body.accessMode, "directo");

  const auth = await json(`${server.url}/api/auth/login`, { method: "POST", headers, body: "{}" });
  assert.equal(auth.response.status, 404);

  const catalogs = await json(`${server.url}/api/import/catalogs`);
  assert.equal(catalogs.response.status, 200);
  assert.equal(catalogs.body.length, 10);

  const template = await json(`${server.url}/api/import/template/unidades`);
  assert.equal(template.response.status, 200);
  assert.ok(template.body.content_base64.length > 100);

  const corrupt = await inspect(server, "corrupto.xlsx", Buffer.from("no es excel").toString("base64"));
  assert.equal(corrupt.response.status, 400);

  const content = await workbookBase64("Unidades", ["Nombre", "Columna adicional", "Código", "Categoría", "Activo"], [
    ["Caja importada", "se ignora", "CAJ-IMP", "CANTIDAD", "Activo"],
  ]);
  const inspected = await inspect(server, "unidades.xlsx", content);
  assert.equal(inspected.response.status, 200);
  assert.equal(inspected.body.sheets[0].name, "Unidades");
  assert.deepEqual(inspected.body.sheets[0].headers, ["Nombre", "Columna adicional", "Código", "Categoría", "Activo"]);

  const mapping = { code: "Código", name: "Nombre", category: "Categoría", active: "Activo" };
  const analyzed = await analyze(server, {
    company_id: null, target_table: "unidades", file_name: "unidades.xlsx", content_base64: content,
    sheet_name: "Unidades", header_row: 1, mapping,
  });
  assert.equal(analyzed.response.status, 200);
  assert.equal(analyzed.body.summary.rows_valid, 1);
  assert.equal(analyzed.body.rows[0].values.code, "CAJ-IMP");

  const confirmed = await confirm(server, {
    company_id: null, target_table: "unidades", file_name: "unidades.xlsx", sheet_name: "Unidades",
    operator_name: "Operador académico", source_company_name: "Corporación Aceros Arequipa S.A.",
    source_url: "https://investors.acerosarequipa.com/", source_period: "Memoria Integrada 2025",
    source_consulted_at: "2026-07-04", transformations: "Normalización de código y categoría.",
    update_existing: false,
    rows: analyzed.body.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: false })),
  });
  assert.equal(confirmed.response.status, 201);
  assert.equal(confirmed.body.created, 1);

  const units = await json(`${server.url}/api/catalog/unidades`);
  assert.equal(units.body.find((item) => item.code === "CAJ-IMP").name, "Caja importada");

  const duplicateAnalysis = await analyze(server, {
    company_id: null, target_table: "unidades", file_name: "unidades.xlsx", content_base64: content,
    sheet_name: "Unidades", header_row: 1, mapping,
  });
  assert.equal(duplicateAnalysis.body.summary.duplicates, 1);
  assert.equal(duplicateAnalysis.body.rows[0].status, "OBSERVADO");

  const duplicateConfirm = await confirm(server, {
    company_id: null, target_table: "unidades", file_name: "unidades.xlsx", sheet_name: "Unidades",
    update_existing: false,
    rows: duplicateAnalysis.body.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: false })),
  });
  assert.equal(duplicateConfirm.response.status, 201);
  assert.equal(duplicateConfirm.body.skipped, 1);

  duplicateAnalysis.body.rows[0].values.name = "Caja actualizada";
  const updateConfirm = await confirm(server, {
    company_id: null, target_table: "unidades", file_name: "unidades.xlsx", sheet_name: "Unidades",
    update_existing: true,
    rows: duplicateAnalysis.body.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: false })),
  });
  assert.equal(updateConfirm.response.status, 201);
  assert.equal(updateConfirm.body.updated, 1);

  const updatedUnits = await json(`${server.url}/api/catalog/unidades`);
  assert.equal(updatedUnits.body.find((item) => item.code === "CAJ-IMP").name, "Caja actualizada");

  const history = await json(`${server.url}/api/import/history`);
  assert.ok(history.body.length >= 3);
  const report = await json(`${server.url}/api/import/history/${history.body[0].id}/errors`);
  assert.equal(report.response.status, 200);
  assert.ok(report.body.content_base64.length > 100);

  const sources = await json(`${server.url}/api/import/sources`);
  assert.ok(sources.body.some((item) => item.company_name === "Corporación Aceros Arequipa S.A."));
  const migration = server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=5").get();
  assert.equal(migration.name, "importacion_tablas_maestras_fase_4");
});

test("Fase 4 rechaza errores críticos y mantiene separación por empresa y persistencia", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-phase4-scope-"));
  let server = await startServer({ port: 0, dataDir });
  const companies = await json(`${server.url}/api/catalog/empresas`);
  const demo = companies.body.find((item) => item.code === "DEMO");
  const pen = (await json(`${server.url}/api/catalog/monedas`)).body.find((item) => item.code === "PEN");
  assert.ok(demo && pen);

  const second = await json(`${server.url}/api/catalog/empresas`, {
    method: "POST", headers,
    body: JSON.stringify({ code: "SEG", commercial_name: "Empresa segunda", legal_name: "Empresa Segunda S.A.C.", tax_id: "20999999991", sector: "Servicios", currency_id: pen.id, active: true }),
  });
  assert.equal(second.response.status, 201);

  const siteContent = await workbookBase64("Sedes", ["Ciudad", "Código", "Nombre", "País", "Activo"], [["Lima", "SEDE-X", "Sede importada", "Perú", "Sí"]]);
  const siteMapping = { code: "Código", name: "Nombre", city: "Ciudad", country: "País", active: "Activo", address: "" };
  for (const companyId of [demo.id, second.body.id]) {
    const result = await analyze(server, { company_id: companyId, target_table: "sedes", file_name: "sedes.xlsx", content_base64: siteContent, sheet_name: "Sedes", header_row: 1, mapping: siteMapping });
    assert.equal(result.response.status, 200);
    const saved = await confirm(server, { company_id: companyId, target_table: "sedes", file_name: "sedes.xlsx", sheet_name: "Sedes", update_existing: false, rows: result.body.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: false })) });
    assert.equal(saved.response.status, 201);
  }

  const demoSites = await json(`${server.url}/api/catalog/sedes?company_id=${demo.id}`);
  const secondSites = await json(`${server.url}/api/catalog/sedes?company_id=${second.body.id}`);
  assert.equal(demoSites.body.filter((item) => item.code === "SEDE-X").length, 1);
  assert.equal(secondSites.body.filter((item) => item.code === "SEDE-X").length, 1);
  assert.notEqual(demoSites.body.find((item) => item.code === "SEDE-X").id, secondSites.body.find((item) => item.code === "SEDE-X").id);

  const invalidEmailContent = await workbookBase64("Responsables", ["Código", "Nombre", "Cargo", "Correo"], [["RESP-X", "Persona inválida", "Jefatura", "correo-invalido"]]);
  const invalidEmail = await analyze(server, {
    company_id: demo.id, target_table: "responsables", file_name: "responsables.xlsx", content_base64: invalidEmailContent,
    sheet_name: "Responsables", header_row: 1, mapping: { code: "Código", full_name: "Nombre", position: "Cargo", email: "Correo", phone: "", active: "" },
  });
  assert.equal(invalidEmail.response.status, 200);
  assert.equal(invalidEmail.body.summary.rows_rejected, 1);

  const blockedConfirm = await confirm(server, {
    company_id: demo.id, target_table: "responsables", file_name: "responsables.xlsx", sheet_name: "Responsables", update_existing: false,
    rows: invalidEmail.body.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: false })),
  });
  assert.equal(blockedConfirm.response.status, 400);

  const excludedConfirm = await confirm(server, {
    company_id: demo.id, target_table: "responsables", file_name: "responsables.xlsx", sheet_name: "Responsables", update_existing: false,
    rows: invalidEmail.body.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: true })),
  });
  assert.equal(excludedConfirm.response.status, 201);
  assert.equal(excludedConfirm.body.excluded, 1);

  const missingColumns = await analyze(server, {
    company_id: demo.id, target_table: "sedes", file_name: "sedes.xlsx", content_base64: siteContent,
    sheet_name: "Sedes", header_row: 1, mapping: { code: "Código", name: "" },
  });
  assert.equal(missingColumns.response.status, 400);

  const missingSheet = await analyze(server, {
    company_id: demo.id, target_table: "sedes", file_name: "sedes.xlsx", content_base64: siteContent,
    sheet_name: "No existe", header_row: 1, mapping: siteMapping,
  });
  assert.equal(missingSheet.response.status, 400);

  const invalidCenterContent = await workbookBase64("Centros", ["Sede", "Responsable", "Código", "Nombre", "Tipo"], [["NO-EXISTE", "NO-EXISTE", "C-X", "Centro inválido", "APOYO"]]);
  const invalidCenter = await analyze(server, {
    company_id: demo.id, target_table: "centros", file_name: "centros.xlsx", content_base64: invalidCenterContent,
    sheet_name: "Centros", header_row: 1, mapping: { site_code: "Sede", responsible_code: "Responsable", code: "Código", name: "Nombre", center_type: "Tipo", description: "", active: "" },
  });
  assert.equal(invalidCenter.body.summary.rows_rejected, 1);
  assert.ok(invalidCenter.body.rows[0].errors.some((message) => message.includes("sede")));

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const persisted = await json(`${server.url}/api/catalog/sedes?company_id=${demo.id}`);
  assert.ok(persisted.body.some((item) => item.code === "SEDE-X"));
  await server.close();
  await rm(dataDir, { recursive: true, force: true });
});
