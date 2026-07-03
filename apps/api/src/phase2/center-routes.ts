import type { Express, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, codeField, normalizeActive, nullableText, positiveId, requirePermission, text, type AuthenticatedRequest, validateCompanyAccess } from "./common";

const schema = z.object({ company_id: positiveId, site_id: positiveId, responsible_id: positiveId, code: codeField(2, 30), name: text(2, 160), center_type: z.enum(["PRODUCTIVO", "APOYO", "COMERCIAL", "ADMINISTRATIVO"]), description: nullableText(), active: activeField });

function ensureReference(database: DatabaseManager, table: "sites" | "responsibles", id: number, companyId: number, label: string) {
  const sql = table === "sites" ? "SELECT id FROM sites WHERE id=? AND company_id=? AND active=1" : "SELECT id FROM responsibles WHERE id=? AND company_id=? AND active=1";
  if (!database.connection.prepare(sql).get(id, companyId)) { const error = new Error(`${label} no pertenece a la empresa activa o está inactivo.`); Object.assign(error, { statusCode: 400 }); throw error; }
}

function linkCompanyAccounts(database: DatabaseManager, centerId: number, companyId: number) {
  database.connection.prepare(`DELETE FROM center_accounts
    WHERE center_id=? AND account_id NOT IN (SELECT id FROM budget_accounts WHERE company_id=?)`)
    .run(centerId, companyId);
  database.connection.prepare(`INSERT OR IGNORE INTO center_accounts (center_id, account_id, active, created_at)
    SELECT ?, id, 1, ? FROM budget_accounts WHERE company_id=? AND active=1`)
    .run(centerId, new Date().toISOString(), companyId);
  database.connection.prepare(`UPDATE center_accounts SET active=1
    WHERE center_id=? AND account_id IN (SELECT id FROM budget_accounts WHERE company_id=?)`)
    .run(centerId, companyId);
}

export function registerCenterRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/catalog/centros", requirePermission("ESTRUCTURA:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId = Number(request.query.company_id || request.identity!.companyId); validateCompanyAccess(request.identity!, companyId);
    response.json(database.connection.prepare("SELECT * FROM activity_centers WHERE company_id=? ORDER BY code").all(companyId));
  });
  app.post("/api/catalog/centros", requirePermission("ESTRUCTURA:CREAR"), (request: AuthenticatedRequest, response: Response) => {
    const input = schema.parse(request.body); validateCompanyAccess(request.identity!, input.company_id); ensureReference(database, "sites", input.site_id, input.company_id, "La sede"); ensureReference(database, "responsibles", input.responsible_id, input.company_id, "El responsable");
    const stamp = new Date().toISOString();
    const id = database.connection.transaction(() => {
      const result = database.connection.prepare("INSERT INTO activity_centers (company_id,site_id,responsible_id,code,name,center_type,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(input.company_id, input.site_id, input.responsible_id, input.code, input.name, input.center_type, input.description ?? null, normalizeActive(input.active ?? 1), stamp, stamp);
      const createdId = Number(result.lastInsertRowid); linkCompanyAccounts(database, createdId, input.company_id); return createdId;
    })();
    audit(database, request.identity!, "CREAR", "activity_centers", id, input.company_id, `Centro ${input.name} creado.`, undefined, input); response.status(201).json({ id, message: "Centro creado correctamente." });
  });
  app.patch("/api/catalog/centros/:id", requirePermission("ESTRUCTURA:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); const input = schema.partial().parse(request.body); const before = database.connection.prepare("SELECT * FROM activity_centers WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Centro no encontrado." }); return; }
    const companyId = Number(input.company_id ?? before.company_id); validateCompanyAccess(request.identity!, companyId); const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    ensureReference(database, "sites", Number(values.site_id), companyId, "La sede"); ensureReference(database, "responsibles", Number(values.responsible_id), companyId, "El responsable");
    database.connection.transaction(() => {
      database.connection.prepare("UPDATE activity_centers SET company_id=?,site_id=?,responsible_id=?,code=?,name=?,center_type=?,description=?,active=?,updated_at=? WHERE id=?")
        .run(values.company_id, values.site_id, values.responsible_id, values.code, values.name, values.center_type, values.description, values.active, new Date().toISOString(), id);
      linkCompanyAccounts(database, id, companyId);
    })();
    audit(database, request.identity!, "EDITAR", "activity_centers", id, companyId, "Centro actualizado.", before, values); response.json({ message: "Centro actualizado correctamente." });
  });
  app.delete("/api/catalog/centros/:id", requirePermission("ESTRUCTURA:ELIMINAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); const before = database.connection.prepare("SELECT * FROM activity_centers WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Centro no encontrado." }); return; }
    validateCompanyAccess(request.identity!, Number(before.company_id));
    database.connection.transaction(() => {
      database.connection.prepare("UPDATE activity_centers SET active=0,updated_at=? WHERE id=?").run(new Date().toISOString(), id);
      database.connection.prepare("UPDATE center_accounts SET active=0 WHERE center_id=?").run(id);
    })();
    audit(database, request.identity!, "ELIMINAR", "activity_centers", id, Number(before.company_id), "Centro desactivado.", before, { ...before, active: 0 }); response.json({ message: "Centro desactivado correctamente." });
  });
}
