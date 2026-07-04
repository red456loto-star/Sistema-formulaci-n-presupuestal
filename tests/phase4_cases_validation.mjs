import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { json, post, startServer, workbookBase64 } from "./phase4-test-helpers.mjs";

test("Fase 4 valida, confirma y conserva tablas maestras", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "phase4-confirm-"));
  let server = await startServer({ port: 0, dataDir });
  context.after(async () => {
    try { await server.close(); } catch {}
    await rm(dataDir, { recursive: true, force: true });
  });

  const content = await workbookBase64(
    "Unidades",
    ["Código", "Nombre", "Categoría"],
    [["CAJ-IMP", "Caja importada", "CANTIDAD"]],
  );
  const request = {
    company_id: null,
    target_table: "unidades",
    file_name: "unidades.xlsx",
    content_base64: content,
    sheet_name: "Unidades",
    header_row: 1,
    mapping: { code: "Código", name: "Nombre", category: "Categoría", active: "" },
  };
  const analyzed = await post(server, "/api/import/analyze", request);
  assert.equal(analyzed.body.summary.rows_valid, 1);

  const confirmed = await post(server, "/api/import/confirm", {
    company_id: null,
    target_table: "unidades",
    file_name: "unidades.xlsx",
    sheet_name: "Unidades",
    update_existing: false,
    rows: analyzed.body.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: false })),
  });
  assert.equal(confirmed.response.status, 201);
  assert.equal(confirmed.body.created, 1);

  const duplicate = await post(server, "/api/import/analyze", request);
  assert.equal(duplicate.body.summary.duplicates, 1);
  assert.equal(duplicate.body.rows[0].status, "OBSERVADO");

  const invalid = await post(server, "/api/import/analyze", {
    ...request,
    mapping: { code: "Código", name: "", category: "Categoría", active: "" },
  });
  assert.equal(invalid.response.status, 400);

  const companies = await json(`${server.url}/api/catalog/empresas`);
  const demo = companies.body.find((item) => item.code === "DEMO");
  assert.ok(demo);
  const hierarchy = await json(`${server.url}/api/organization/hierarchy?company_id=${demo.id}`);
  assert.equal(hierarchy.response.status, 200);
  assert.ok(hierarchy.body.organizational.length >= 1);
  assert.ok(hierarchy.body.organizational[0].centers.length >= 1);
  assert.ok(hierarchy.body.organizational[0].centers[0].responsible_name);

  const history = await json(`${server.url}/api/import/history`);
  assert.ok(history.body.length >= 1);
  assert.equal(server.database.connection.prepare("SELECT name FROM schema_migrations WHERE version=5").get().name, "importacion_tablas_maestras_fase_4");

  await server.close();
  server = await startServer({ port: 0, dataDir });
  const units = await json(`${server.url}/api/catalog/unidades`);
  assert.ok(units.body.some((item) => item.code === "CAJ-IMP"));
});
