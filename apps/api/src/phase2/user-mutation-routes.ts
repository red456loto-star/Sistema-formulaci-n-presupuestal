import type { Express, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, emailField, positiveId, requirePermission, text, type AuthenticatedRequest, validateCompanyAccess } from "./common";

export function registerUserMutationRoutes(app: Express, database: DatabaseManager) {
  app.patch("/api/users/:id", requirePermission("USUARIOS:EDITAR"), (request: AuthenticatedRequest, response: Response) => {
    const id = Number(request.params.id);
    const input = z.object({ company_id: positiveId.nullable().optional(), full_name: text(3, 160).optional(), email: emailField.optional(), role_ids: z.array(positiveId).min(1).optional(), active: activeField }).parse(request.body);
    const before = database.connection.prepare("SELECT id, company_id, username, full_name, email, active FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!before) { response.status(404).json({ code: "NOT_FOUND", message: "Usuario no encontrado." }); return; }
    if (before.company_id) validateCompanyAccess(request.identity!, Number(before.company_id));
    if (input.company_id) validateCompanyAccess(request.identity!, input.company_id);
    database.connection.transaction(() => {
      if (input.full_name !== undefined) database.connection.prepare("UPDATE users SET full_name=?, updated_at=? WHERE id=?").run(input.full_name, new Date().toISOString(), id);
      if (input.email !== undefined) database.connection.prepare("UPDATE users SET email=?, updated_at=? WHERE id=?").run(input.email, new Date().toISOString(), id);
      if (input.company_id !== undefined) database.connection.prepare("UPDATE users SET company_id=?, updated_at=? WHERE id=?").run(input.company_id, new Date().toISOString(), id);
      if (input.active !== undefined) database.connection.prepare("UPDATE users SET active=?, updated_at=? WHERE id=?").run(input.active === true || input.active === 1 ? 1 : 0, new Date().toISOString(), id);
      if (input.role_ids) {
        database.connection.prepare("DELETE FROM user_roles WHERE user_id=?").run(id);
        const insertRole = database.connection.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
        input.role_ids.forEach((roleId) => insertRole.run(id, roleId));
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
    database.connection.prepare("UPDATE users SET active=0, updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    audit(database, request.identity!, "ELIMINAR", "users", id, Number(before.company_id ?? 0) || null, `Usuario ${before.username} desactivado.`, before, { ...before, active: 0 });
    response.json({ message: "Usuario desactivado correctamente." });
  });
}
