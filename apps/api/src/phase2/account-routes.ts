import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, codeField, ensureCompanyExists, normalizeActive, nullableText, positiveId, requireCompanyId, text } from "./common";

const schema = z.object({
  company_id: positiveId,
  element_id: positiveId,
  code: codeField(2, 40),
  name: text(2, 180),
  nature: z.enum(["INGRESO", "COSTO", "GASTO", "ACTIVO", "PASIVO", "PATRIMONIO"]),
  movement_type: z.enum(["DETALLE", "ACUMULADORA"]).optional(),
  description: nullableText(),
  active: activeField,
});

function ensureElement(database: DatabaseManager, elementId: number, companyId: number) {
  return Boolean(database.connection.prepare("SELECT id FROM budget_elements WHERE id=? AND company_id=? AND active=1").get(elementId, companyId));
}

function linkAccountToCenters(database: DatabaseManager, accountId: number, companyId: number) {
  database.connection.prepare(`DELETE FROM center_accounts
    WHERE account_id=? AND center_id NOT IN (SELECT id FROM activity_centers WHERE company_id=?)`)
    .run(accountId, companyId);
  database.connection.prepare(`INSERT OR IGNORE INTO center_accounts (center_id, account_id, active, created_at)
    SELECT id, ?, 1, ? FROM activity_centers WHERE company_id=? AND active=1`)
    .run(accountId, new Date().toISOString(), companyId);
  database.connection.prepare(`UPDATE center_accounts SET active=1
    WHERE account_id=? AND center_id IN (SELECT id FROM activity_centers WHERE company_id=?)`)
    .run(accountId, companyId);
}

export function registerAccountRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/catalog/cuentas", (request: Request, response: Response) => {
    const companyId = requireCompanyId(request.query.company_id); ensureCompanyExists(database, companyId);
    response.json(database.connection.prepare("SELECT * FROM budget_accounts WHERE company_id=? ORDER BY code").all(companyId));
  });

  app.post("/api/catalog/cuentas", (request: Request, response: Response) => {
    const input = schema.parse(request.body);
    ensureCompanyExists(database, input.company_id, true);
    if (!ensureElement(database, input.element_id, input.company_id)) { response.status(400).json({ code: "INVALID_ELEMENT", message: "El elemento no pertenece a la empresa activa o está inactivo." }); return; }
    const stamp = new Date().toISOString();
    const id = database.connection.transaction(() => {
      const result = database.connection.prepare("INSERT INTO budget_accounts (company_id,element_id,code,name,nature,movement_type,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(input.company_id, input.element_id, input.code, input.name, input.nature, input.movement_type ?? "DETALLE", input.description ?? null, normalizeActive(input.active ?? 1), stamp, stamp);
      const createdId = Number(result.lastInsertRowid);
      linkAccountToCenters(database, createdId, input.company_id);
      return createdId;
    })();
    audit(database, "CREAR", "budget_accounts", id, input.company_id, `Cuenta ${input.name} creada.`, undefined, input);
    response.status(201).json({ id, message: "Cuenta creada correctamente." });
  });

  app.patch("/api/catalog/cuentas/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = schema.partial().parse(request.body);
    const before = database.connection.prepare("SELECT * FROM budget_accounts WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Cuenta no encontrada." }); return; }
    const companyId = Number(input.company_id ?? before.company_id);
    const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    if (!ensureElement(database, Number(values.element_id), companyId)) { response.status(400).json({ code: "INVALID_ELEMENT", message: "El elemento no pertenece a la empresa activa o está inactivo." }); return; }
    database.connection.transaction(() => {
      database.connection.prepare("UPDATE budget_accounts SET company_id=?,element_id=?,code=?,name=?,nature=?,movement_type=?,description=?,active=?,updated_at=? WHERE id=?")
        .run(values.company_id, values.element_id, values.code, values.name, values.nature, values.movement_type, values.description, values.active, new Date().toISOString(), id);
      if (Number(values.active) === 1) linkAccountToCenters(database, id, companyId);
    })();
    audit(database, "EDITAR", "budget_accounts", id, companyId, "Cuenta actualizada.", before, values);
    response.json({ message: "Cuenta actualizada correctamente." });
  });

  app.delete("/api/catalog/cuentas/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const before = database.connection.prepare("SELECT * FROM budget_accounts WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Cuenta no encontrada." }); return; }
    database.connection.transaction(() => {
      database.connection.prepare("UPDATE budget_accounts SET active=0,updated_at=? WHERE id=?").run(new Date().toISOString(), id);
      database.connection.prepare("UPDATE center_accounts SET active=0 WHERE account_id=?").run(id);
    })();
    audit(database, "ELIMINAR", "budget_accounts", id, Number(before.company_id), "Cuenta desactivada.", before, { ...before, active: 0 });
    response.json({ message: "Cuenta desactivada correctamente." });
  });
}
