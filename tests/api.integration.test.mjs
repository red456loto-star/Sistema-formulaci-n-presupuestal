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

const headers = { "Content-Type": "application/json" };

test("Fase 2 funciona con acceso directo, sin login, usuarios ni permisos", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "presucontrol-test-"));
  const instance = await startServer({ port: 0, dataDir });

  context.after(async () => {
    await instance.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await json(`${instance.url}/api/health`);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.phase, 3);
  assert.equal(health.body.accessMode, "directo");

  const login = await json(`${instance.url}/api/auth/login`, { method: "POST", headers, body: "{}" });
  assert.equal(login.response.status, 404);
  const users = await json(`${instance.url}/api/users`);
  assert.equal(users.response.status, 404);
  const roles = await json(`${instance.url}/api/roles`);
  assert.equal(roles.response.status, 404);

  const currencies = await json(`${instance.url}/api/catalog/monedas`);
  assert.equal(currencies.response.status, 200);
  const pen = currencies.body.find((item) => item.code === "PEN");
  assert.ok(pen);

  const companyCreate = await json(`${instance.url}/api/catalog/empresas`, {
    method: "POST", headers,
    body: JSON.stringify({ code: "test", commercial_name: "Empresa de prueba", legal_name: "Empresa de Prueba S.A.C.", tax_id: "20123456789", sector: "Servicios", currency_id: pen.id, email: "empresa@test.local", active: true }),
  });
  assert.equal(companyCreate.response.status, 201);
  const companyId = companyCreate.body.id;

  const duplicate = await json(`${instance.url}/api/catalog/empresas`, {
    method: "POST", headers,
    body: JSON.stringify({ code: "TEST", commercial_name: "Duplicada", legal_name: "Duplicada S.A.C.", tax_id: "20123456780", sector: "Servicios", currency_id: pen.id, active: true }),
  });
  assert.equal(duplicate.response.status, 409);

  const siteCreate = await json(`${instance.url}/api/catalog/sedes`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: companyId, code: "lim", name: "Lima", city: "Lima", country: "Perú", active: true }),
  });
  assert.equal(siteCreate.response.status, 201);

  const missingResponsible = await json(`${instance.url}/api/catalog/centros`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: companyId, site_id: siteCreate.body.id, code: "SIN", name: "Sin responsable", center_type: "APOYO", active: true }),
  });
  assert.equal(missingResponsible.response.status, 400);

  const responsibleCreate = await json(`${instance.url}/api/catalog/responsables`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: companyId, code: "r001", full_name: "Responsable Prueba", position: "Jefatura", email: "responsable@test.local", active: true }),
  });
  assert.equal(responsibleCreate.response.status, 201);

  const centerCreate = await json(`${instance.url}/api/catalog/centros`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: companyId, site_id: siteCreate.body.id, responsible_id: responsibleCreate.body.id, code: "adm", name: "Administración", center_type: "ADMINISTRATIVO", active: true }),
  });
  assert.equal(centerCreate.response.status, 201);

  const groupCreate = await json(`${instance.url}/api/catalog/grupos`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: companyId, code: "gas", name: "Gastos", active: true }),
  });
  assert.equal(groupCreate.response.status, 201);
  const elementCreate = await json(`${instance.url}/api/catalog/elementos`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: companyId, group_id: groupCreate.body.id, code: "ser", name: "Servicios", active: true }),
  });
  assert.equal(elementCreate.response.status, 201);
  const accountCreate = await json(`${instance.url}/api/catalog/cuentas`, {
    method: "POST", headers,
    body: JSON.stringify({ company_id: companyId, element_id: elementCreate.body.id, code: "6311", name: "Energía", nature: "GASTO", movement_type: "DETALLE", active: true }),
  });
  assert.equal(accountCreate.response.status, 201);

  const hierarchy = await json(`${instance.url}/api/organization/hierarchy?company_id=${companyId}`);
  assert.equal(hierarchy.response.status, 200);
  assert.equal(hierarchy.body.company.code, "TEST");
  assert.equal(hierarchy.body.organizational[0].code, "LIM");
  assert.equal(hierarchy.body.organizational[0].centers[0].code, "ADM");
  assert.equal(hierarchy.body.organizational[0].centers[0].responsible_name, "Responsable Prueba");
  assert.equal(hierarchy.body.organizational[0].centers[0].budget[0].code, "GAS");
  assert.equal(hierarchy.body.organizational[0].centers[0].budget[0].elements[0].code, "SER");
  assert.equal(hierarchy.body.organizational[0].centers[0].budget[0].elements[0].accounts[0].code, "6311");

  const backup = await json(`${instance.url}/api/system/backup`, { method: "POST", headers, body: "{}" });
  assert.equal(backup.response.status, 201);
  const status = await json(`${instance.url}/api/system/database-status`);
  assert.equal(status.body.connected, true);
  assert.equal(status.body.accessMode, "directo_sin_login");
  assert.ok(status.body.latestBackup);
  assert.ok(status.body.companyRows >= 2);

  const authTables = instance.database.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','roles','permissions','sessions','user_roles','role_permissions')").all();
  assert.deepEqual(authTables, []);
});
