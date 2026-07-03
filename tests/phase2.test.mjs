import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { startServer } = require("../apps/api/dist/server.cjs");

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

test("Fase 2: autenticación, empresas y jerarquía funcionan", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "presucontrol-phase2-"));
  const server = await startServer({ port: 0, host: "127.0.0.1", dataDir });
  try {
    const login = await json(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "Admin123!" }),
    });
    assert.ok(login.token);
    assert.equal(login.user.username, "admin");
    assert.ok(login.user.permissions.includes("EMPRESAS:CREAR"));

    const headers = { authorization: `Bearer ${login.token}`, "content-type": "application/json" };
    const currencies = await json(`${server.url}/api/catalog/monedas`, { headers });
    const pen = currencies.find((item) => item.code === "PEN");
    assert.ok(pen);

    const created = await json(`${server.url}/api/catalog/empresas`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "TEST",
        commercial_name: "Empresa de prueba",
        legal_name: "Empresa de Prueba S.A.C.",
        tax_id: "20999999992",
        sector: "Pruebas",
        currency_id: pen.id,
        email: "pruebas@presucontrol.local",
        active: true,
      }),
    });
    assert.ok(created.id > 0);

    await json(`${server.url}/api/catalog/sedes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ company_id: created.id, code: "LIM", name: "Sede Lima", city: "Lima", country: "Perú", active: true }),
    });
    await json(`${server.url}/api/catalog/grupos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ company_id: created.id, code: "ING", name: "Ingresos", description: "Grupo de prueba", active: true }),
    });

    const hierarchy = await json(`${server.url}/api/organization/hierarchy?company_id=${created.id}`, { headers });
    assert.equal(hierarchy.company.commercial_name, "Empresa de prueba");
    assert.equal(hierarchy.organizational.length, 1);
    assert.equal(hierarchy.budget.length, 1);

    const audits = await json(`${server.url}/api/audit?company_id=${created.id}`, { headers });
    assert.ok(audits.some((event) => event.entity === "companies" && event.action === "CREAR"));
  } finally {
    await server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
