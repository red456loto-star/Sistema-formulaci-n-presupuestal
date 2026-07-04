import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { json, post, startServer, workbookBase64 } from "./phase4-test-helpers.mjs";

test("Fase 4 inspecciona archivos Excel válidos", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "phase4-inspect-"));
  const server = await startServer({ port: 0, dataDir });
  context.after(async () => {
    try { await server.close(); } catch {}
    await rm(dataDir, { recursive: true, force: true });
  });

  const health = await json(`${server.url}/api/health`);
  assert.equal(health.body.phase, 4);
  assert.equal(health.body.accessMode, "directo");
  assert.equal((await json(`${server.url}/api/import/catalogs`)).body.length, 10);

  const content = await workbookBase64(
    "Unidades",
    ["Nombre", "Código", "Categoría"],
    [["Caja", "CAJ", "CANTIDAD"]],
  );
  const inspected = await post(server, "/api/import/inspect", {
    file_name: "unidades.xlsx",
    content_base64: content,
  });
  assert.equal(inspected.response.status, 200);
  assert.equal(inspected.body.sheets[0].name, "Unidades");
  assert.deepEqual(inspected.body.sheets[0].headers, ["Nombre", "Código", "Categoría"]);

  const template = await json(`${server.url}/api/import/template/unidades`);
  assert.ok(template.body.content_base64.length > 100);
});
