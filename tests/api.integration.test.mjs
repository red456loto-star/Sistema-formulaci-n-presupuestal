import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");

async function json(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json();
  return { response, body };
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

test("Fase 2 integra autenticación, permisos, empresa, jerarquía y auditoría", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-test-"));
  const instance = await startServer({ port: 0, dataDir });

  context.after(async () => {
    await instance.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await json(`${instance.url}/api/health`);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.phase, 2);
  assert.equal(health.body.database, "conectada");

  const login = await json(`${instance.url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: ["Admin", "123", "!"].join("") }),
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.body.token);
  assert.ok(login.body.user.permissions.includes("EMPRESAS:CREAR"));
  assert.ok(login.body.user.permissions.includes("SISTEMA:CREAR"));
  const adminHeaders = auth(login.body.token);

  const currencies = await json(`${instance.url}/api/catalog/monedas`, { headers: adminHeaders });
  const pen = currencies.body.find((item) => item.code === "PEN");
  assert.ok(pen);

  const companyCreate = await json(`${instance.url}/api/catalog/empresas`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ code: "test", commercial_name: "Empresa de prueba", legal_name: "Empresa de Prueba S.A.C.", tax_id: "20123456789", sector: "Servicios", currency_id: pen.id, email: "empresa@test.local", active: true }),
  });
  assert.equal(companyCreate.response.status, 201);
  const companyId = companyCreate.body.id;

  const duplicate = await json(`${instance.url}/api/catalog/empresas`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ code: "TEST", commercial_name: "Duplicada", legal_name: "Duplicada S.A.C.", tax_id: "20123456780", sector: "Servicios", currency_id: pen.id, active: true }),
  });
  assert.equal(duplicate.response.status, 409);

  const siteCreate = await json(`${instance.url}/api/catalog/sedes`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, code: "lim", name: "Lima", city: "Lima", country: "Perú", active: true }),
  });
  assert.equal(siteCreate.response.status, 201);

  const missingResponsible = await json(`${instance.url}/api/catalog/centros`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, site_id: siteCreate.body.id, code: "SIN", name: "Sin responsable", center_type: "APOYO", active: true }),
  });
  assert.equal(missingResponsible.response.status, 400);

  const responsibleCreate = await json(`${instance.url}/api/catalog/responsables`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, code: "r001", full_name: "Responsable Prueba", position: "Jefatura", email: "responsable@test.local", active: true }),
  });
  assert.equal(responsibleCreate.response.status, 201);

  const centerCreate = await json(`${instance.url}/api/catalog/centros`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, site_id: siteCreate.body.id, responsible_id: responsibleCreate.body.id, code: "adm", name: "Administración", center_type: "ADMINISTRATIVO", active: true }),
  });
  assert.equal(centerCreate.response.status, 201);

  const groupCreate = await json(`${instance.url}/api/catalog/grupos`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, code: "gas", name: "Gastos", active: true }),
  });
  assert.equal(groupCreate.response.status, 201);
  const elementCreate = await json(`${instance.url}/api/catalog/elementos`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, group_id: groupCreate.body.id, code: "ser", name: "Servicios", active: true }),
  });
  assert.equal(elementCreate.response.status, 201);
  const accountCreate = await json(`${instance.url}/api/catalog/cuentas`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, element_id: elementCreate.body.id, code: "6311", name: "Energía", nature: "GASTO", movement_type: "DETALLE", active: true }),
  });
  assert.equal(accountCreate.response.status, 201);

  const hierarchy = await json(`${instance.url}/api/organization/hierarchy?company_id=${companyId}`, { headers: adminHeaders });
  assert.equal(hierarchy.response.status, 200);
  assert.equal(hierarchy.body.company.code, "TEST");
  assert.equal(hierarchy.body.organizational[0].code, "LIM");
  assert.equal(hierarchy.body.organizational[0].centers[0].code, "ADM");
  assert.equal(hierarchy.body.organizational[0].centers[0].responsible_name, "Responsable Prueba");
  assert.equal(hierarchy.body.organizational[0].centers[0].budget[0].code, "GAS");
  assert.equal(hierarchy.body.organizational[0].centers[0].budget[0].elements[0].code, "SER");
  assert.equal(hierarchy.body.organizational[0].centers[0].budget[0].elements[0].accounts[0].code, "6311");

  const roles = await json(`${instance.url}/api/roles`, { headers: adminHeaders });
  const consultaRole = roles.body.find((item) => item.code === "CONSULTA");
  const userCreate = await json(`${instance.url}/api/users`, {
    method: "POST", headers: adminHeaders,
    body: JSON.stringify({ company_id: companyId, username: "consulta.test", full_name: "Consulta Test", email: "consulta@test.local", role_ids: [consultaRole.id], active: true }),
  });
  assert.equal(userCreate.response.status, 201);

  const consultaLogin = await json(`${instance.url}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "consulta.test", password: ["Temporal", "123", "!"].join("") }),
  });
  assert.equal(consultaLogin.response.status, 200);
  const consultaHeaders = auth(consultaLogin.body.token);
  const forbidden = await json(`${instance.url}/api/catalog/grupos`, {
    method: "POST", headers: consultaHeaders,
    body: JSON.stringify({ company_id: companyId, code: "NO", name: "No autorizado", active: true }),
  });
  assert.equal(forbidden.response.status, 403);

  const forbiddenBackup = await json(`${instance.url}/api/system/backup`, { method: "POST", headers: consultaHeaders, body: "{}" });
  assert.equal(forbiddenBackup.response.status, 403);

  const audit = await json(`${instance.url}/api/audit?company_id=${companyId}`, { headers: adminHeaders });
  assert.equal(audit.response.status, 200);
  assert.ok(audit.body.some((event) => event.entity === "companies" && event.action === "CREAR"));
  assert.ok(audit.body.some((event) => event.entity === "activity_centers" && event.action === "CREAR"));

  const backup = await json(`${instance.url}/api/system/backup`, { method: "POST", headers: adminHeaders, body: "{}" });
  assert.equal(backup.response.status, 201);
  const status = await json(`${instance.url}/api/system/database-status`, { headers: adminHeaders });
  assert.equal(status.body.connected, true);
  assert.ok(status.body.latestBackup);
  assert.ok(status.body.companyRows >= 2);
  assert.ok(status.body.userRows >= 2);
});
