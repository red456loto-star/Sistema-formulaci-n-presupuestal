import type { Express, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, emailField, ensureActiveCompany, ensureActiveRoles, positiveId, requirePermission, text, type AuthenticatedRequest, validateCompanyAccess } from "./common";

function wouldRemoveLastAdministrator(database: DatabaseManager, userId: number, roleIds: number[] | undefined, active: boolean | number | undefined) {
  const adminRole = database.connection.prepare("SELECT id FROM roles WHERE code='ADMINISTRADOR'").get() as { id: number };
  const currentlyAdmin = Boolean(database.connection.prepare("SELECT 1 FROM user_roles WHERE user_id=? AND role_id=?").get(userId, adminRole.id));
  if (!currentlyAdmin) return false;
  const remainsActive = active === undefined || active === true || active === 1;
  const remainsAdmin = roleIds === undefined || roleIds.includes(adminRole.id);
  if (remainsActive && remainsAdmin) return false;
  const others = database.connection.prepare(`SELECT COUNT(DISTINCT u.id) AS total
    FROM users u JOIN user_roles ur ON ur.user_id=u.id
    WHERE ur.role_id=? AND u.active=1 AND u.id<>?`).get(adminRole.id, userId) as { total: number };
  return others.total === 0;
}

export function registerUserMutationRoutes(app: Express, database: DatabaseManager) {
  app.patch("/api/users/:id", requirePermission("USUARIOS:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id);
    const input = z.object({ company_id: positiveId.nullable().optional(), full_name: text(3, 160).optional(), email: emailField.optional(), role_ids: z.array(positiveId).min(1).optional(), active: activeField }).parse(request.body);
    const before = database.connection.prepare("SELECT id, company_id, username, full_name, email, active FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Usuario no encontrado." }); return; }
    if (before.company_id) validateCompanyAccess(request.identity!, Number(before.company_id));
    if (input.company_id) { validateCompanyAccess(request.identity!, input.company_id); ensureActiveCompany(database, input.company_id); }
    if (input.role_ids) ensureActiveRoles(database, input.role_ids);
    if (id === request.identity!.id && (input.company_id !== undefined || input.role_ids !== undefined || input.active === false || input.active === 0)) {
      response.status(400).json({ code: "SELF_LOCKOUT", message: "No puede cambiar su propia empresa, roles ni desactivar su usuario." });
      return;
    }
    if (wouldRemoveLastAdministrator(database, id, input.role_ids, input.active)) {
      response.status(400).json({ code: "LAST_ADMIN", message: "Debe existir al menos un administrador activo en el sistema." });
      return;
    }
    database.connection.transaction(() => {
      const stamp = new Date().toISOString();
      if (input.full_name !== undefined) database.connection.prepare("UPDATE users SET full_name=?, updated_at=? WHERE id=?").run(input.full_name, stamp, id);
      if (input.email !== undefined) database.connection.prepare("UPDATE users SET email=?, updated_at=? WHERE id=?").run(input.email, stamp, id);
      if (input.company_id !== undefined) database.connection.prepare("UPDATE users SET company_id=?, updated_at=? WHERE id=?").run(input.company_id, stamp, id);
      if (input.active !== undefined) database.connection.prepare("UPDATE users SET active=?, updated_at=? WHERE id=?").run(input.active === true || input.active === 1 ? 1 : 0, stamp, id);
      if (input.role_ids) {
        database.connection.prepare("DELETE FROM user_roles WHERE user_id=?").run(id);
        const insertRole = database.connection.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
        [...new Set(input.role_ids)].forEach((roleId) => insertRole.run(id, roleId));
      }
    })();
    const after = database.connection.prepare("SELECT id, company_id, username, full_name, email, active FROM users WHERE id=?").get(id);
    audit(database, request.identity!, "EDITAR", "users", id, Number(input.company_id ?? before.company_id ?? 0) || null, `Usuario ${before.username} actualizado.`, before, after);
    response.json({ message: "Usuario actualizado correctamente." });
  });

  app.delete("/api/users/:id", requirePermission("USUARIOS:ELIMINAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id);
    if (id === request.identity!.id) { response.status(400).json({ code: "SELF_DELETE", message: "No puede desactivar su propio usuario." }); return; }
    const before = database.connection.prepare("SELECT id, company_id, username, active FROM users WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Usuario no encontrado." }); return; }
    if (before.company_id) validateCompanyAccess(request.identity!, Number(before.company_id));
    if (wouldRemoveLastAdministrator(database, id, undefined, false)) { response.status(400).json({ code: "LAST_ADMIN", message: "Debe existir al menos un administrador activo en el sistema." }); return; }
    database.connection.prepare("UPDATE users SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    audit(database, request.identity!, "ELIMINAR", "users", id, Number(before.company_id ?? 0) || null, `Usuario ${before.username} desactivado.`, before, { ...before, active: 0 });
    response.json({ message: "Usuario desactivado correctamente." });
  });
}
