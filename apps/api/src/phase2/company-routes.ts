import type { Express, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, codeField, emailField, isAdmin, normalizeActive, nullableText, positiveId, requirePermission, text, type AuthenticatedRequest, validateCompanyAccess } from "./common";

const companySchema = z.object({ code: codeField(2, 20), commercial_name: text(2, 160), legal_name: text(2, 200), tax_id: text(8, 20), sector: text(2, 120), currency_id: positiveId, address: nullableText(), email: z.string().trim().email().optional().nullable(), phone: nullableText(40), active: activeField });
const siteSchema = z.object({ company_id: positiveId, code: codeField(2, 20), name: text(2, 160), address: nullableText(), city: nullableText(100), country: text(2, 80).optional(), active: activeField });
const responsibleSchema = z.object({ company_id: positiveId, code: codeField(2, 30), full_name: text(2, 160), position: text(2, 120), email: emailField, phone: nullableText(40), active: activeField });

export function registerCompanyRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/catalog/empresas", requirePermission("EMPRESAS:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const rows = isAdmin(request.identity!)
      ? database.connection.prepare("SELECT * FROM companies ORDER BY commercial_name").all()
      : database.connection.prepare("SELECT * FROM companies WHERE id = ? ORDER BY commercial_name").all(request.identity!.companyId);
    response.json(rows);
  });

  app.post("/api/catalog/empresas", requirePermission("EMPRESAS:CREAR"), (request: AuthenticatedRequest, response: Response) => {
    const input = companySchema.parse(request.body);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO companies
      (code, commercial_name, legal_name, tax_id, sector, currency_id, address, email, phone, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(input.code, input.commercial_name, input.legal_name, input.tax_id, input.sector, input.currency_id, input.address ?? null, input.email ?? null, input.phone ?? null, normalizeActive(input.active ?? 1), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    audit(database, request.identity!, "CREAR", "companies", id, id, `Empresa ${input.commercial_name} creada.`, undefined, input);
    response.status(201).json({ id, message: "Empresa creada correctamente." });
  });

  app.patch("/api/catalog/empresas/:id", requirePermission("EMPRESAS:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); validateCompanyAccess(request.identity!, id);
    const input = companySchema.partial().parse(request.body);
    const before = database.connection.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Empresa no encontrada." }); return; }
    const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    database.connection.prepare(`UPDATE companies SET code=?, commercial_name=?, legal_name=?, tax_id=?, sector=?, currency_id=?, address=?, email=?, phone=?, active=?, updated_at=? WHERE id=?`)
      .run(values.code, values.commercial_name, values.legal_name, values.tax_id, values.sector, values.currency_id, values.address, values.email, values.phone, values.active, new Date().toISOString(), id);
    audit(database, request.identity!, "EDITAR", "companies", id, id, "Empresa actualizada.", before, values);
    response.json({ message: "Empresa actualizada correctamente." });
  });

  app.delete("/api/catalog/empresas/:id", requirePermission("EMPRESAS:ELIMINAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); validateCompanyAccess(request.identity!, id);
    const before = database.connection.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Empresa no encontrada." }); return; }
    database.connection.prepare("UPDATE companies SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    audit(database, request.identity!, "ELIMINAR", "companies", id, id, "Empresa desactivada.", before, { ...before, active: 0 });
    response.json({ message: "Empresa desactivada correctamente." });
  });

  app.get("/api/catalog/sedes", requirePermission("EMPRESAS:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId = Number(request.query.company_id || request.identity!.companyId); validateCompanyAccess(request.identity!, companyId);
    response.json(database.connection.prepare("SELECT * FROM sites WHERE company_id = ? ORDER BY name").all(companyId));
  });

  app.post("/api/catalog/sedes", requirePermission("EMPRESAS:CREAR"), (request: AuthenticatedRequest, response: Response) => {
    const input = siteSchema.parse(request.body); validateCompanyAccess(request.identity!, input.company_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO sites (company_id, code, name, address, city, country, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(input.company_id, input.code, input.name, input.address ?? null, input.city ?? null, input.country ?? "Perú", normalizeActive(input.active ?? 1), stamp, stamp);
    const id = Number(result.lastInsertRowid); audit(database, request.identity!, "CREAR", "sites", id, input.company_id, `Sede ${input.name} creada.`, undefined, input);
    response.status(201).json({ id, message: "Sede creada correctamente." });
  });

  app.patch("/api/catalog/sedes/:id", requirePermission("EMPRESAS:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); const input = siteSchema.partial().parse(request.body);
    const before = database.connection.prepare("SELECT * FROM sites WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Sede no encontrada." }); return; }
    const companyId = Number(input.company_id ?? before.company_id); validateCompanyAccess(request.identity!, companyId);
    const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    database.connection.prepare("UPDATE sites SET company_id=?, code=?, name=?, address=?, city=?, country=?, active=?, updated_at=? WHERE id=?")
      .run(values.company_id, values.code, values.name, values.address, values.city, values.country, values.active, new Date().toISOString(), id);
    audit(database, request.identity!, "EDITAR", "sites", id, companyId, "Sede actualizada.", before, values); response.json({ message: "Sede actualizada correctamente." });
  });

  app.delete("/api/catalog/sedes/:id", requirePermission("EMPRESAS:ELIMINAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); const before = database.connection.prepare("SELECT * FROM sites WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Sede no encontrada." }); return; }
    validateCompanyAccess(request.identity!, Number(before.company_id)); database.connection.prepare("UPDATE sites SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    audit(database, request.identity!, "ELIMINAR", "sites", id, Number(before.company_id), "Sede desactivada.", before, { ...before, active: 0 }); response.json({ message: "Sede desactivada correctamente." });
  });

  app.get("/api/catalog/responsables", requirePermission("EMPRESAS:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId = Number(request.query.company_id || request.identity!.companyId); validateCompanyAccess(request.identity!, companyId);
    response.json(database.connection.prepare("SELECT * FROM responsibles WHERE company_id = ? ORDER BY full_name").all(companyId));
  });

  app.post("/api/catalog/responsables", requirePermission("EMPRESAS:CREAR"), (request: AuthenticatedRequest, response: Response) => {
    const input = responsibleSchema.parse(request.body); validateCompanyAccess(request.identity!, input.company_id);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO responsibles (company_id, code, full_name, position, email, phone, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(input.company_id, input.code, input.full_name, input.position, input.email, input.phone ?? null, normalizeActive(input.active ?? 1), stamp, stamp);
    const id = Number(result.lastInsertRowid); audit(database, request.identity!, "CREAR", "responsibles", id, input.company_id, `Responsable ${input.full_name} creado.`, undefined, input);
    response.status(201).json({ id, message: "Responsable creado correctamente." });
  });

  app.patch("/api/catalog/responsables/:id", requirePermission("EMPRESAS:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); const input = responsibleSchema.partial().parse(request.body);
    const before = database.connection.prepare("SELECT * FROM responsibles WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Responsable no encontrado." }); return; }
    const companyId = Number(input.company_id ?? before.company_id); validateCompanyAccess(request.identity!, companyId);
    const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active) } as Record<string, unknown>;
    database.connection.prepare("UPDATE responsibles SET company_id=?, code=?, full_name=?, position=?, email=?, phone=?, active=?, updated_at=? WHERE id=?")
      .run(values.company_id, values.code, values.full_name, values.position, values.email, values.phone, values.active, new Date().toISOString(), id);
    audit(database, request.identity!, "EDITAR", "responsibles", id, companyId, "Responsable actualizado.", before, values); response.json({ message: "Responsable actualizado correctamente." });
  });

  app.delete("/api/catalog/responsables/:id", requirePermission("EMPRESAS:ELIMINAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id); const before = database.connection.prepare("SELECT * FROM responsibles WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Responsable no encontrado." }); return; }
    validateCompanyAccess(request.identity!, Number(before.company_id)); database.connection.prepare("UPDATE responsibles SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    audit(database, request.identity!, "ELIMINAR", "responsibles", id, Number(before.company_id), "Responsable desactivado.", before, { ...before, active: 0 }); response.json({ message: "Responsable desactivado correctamente." });
  });
}
