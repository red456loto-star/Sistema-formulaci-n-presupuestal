import type { Express, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import type { ApiErrorResponse } from "../../../../packages/shared/src/index";
import { activeField, audit, emailField, ensureActiveCompany, ensureActiveRoles, positiveId, requirePermission, type AuthenticatedRequest, text, validateCompanyAccess } from "./common";

export function registerPublicAuthRoutes(app: Express, database: DatabaseManager) {
  app.post("/api/auth/login", (request, response) => {
    const input = z.object({ username: text(2, 80), password: z.string().min(8).max(200) }).parse(request.body);
    const user = database.connection.prepare(`SELECT u.id, u.username, u.full_name, u.email, u.company_id, u.password_hash, u.password_salt, u.active,
      CASE WHEN u.company_id IS NULL THEN 1 ELSE c.active END AS company_active
      FROM users u LEFT JOIN companies c ON c.id = u.company_id
      WHERE lower(u.username) = lower(?)`).get(input.username) as Record<string, unknown> | undefined;
    if (!user || !Boolean(user.active) || !Boolean(user.company_active) || !database.verifyPassword(input.password, String(user.password_hash), String(user.password_salt))) {
      response.status(401).json({ code: "INVALID_CREDENTIALS", message: "Usuario o contraseña incorrectos, o la empresa se encuentra inactiva." } satisfies ApiErrorResponse);
      return;
    }
    const session = database.createSession(Number(user.id));
    response.json({ ...session, user: database.getIdentityByToken(session.token) });
  });
}

export function registerProtectedAuthRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/auth/me", (request: AuthenticatedRequest, response: Response) => response.json(request.identity));

  app.post("/api/auth/logout", (request: AuthenticatedRequest, response: Response) => {
    if (request.authToken) database.revokeSession(request.authToken);
    response.json({ message: "Sesión cerrada correctamente." });
  });

  app.post("/api/auth/change-password", (request: AuthenticatedRequest, response: Response) => {
    const input = z.object({ currentPassword: z.string().min(8), newPassword: z.string().min(8).max(200) }).parse(request.body);
    const user = database.connection.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(request.identity!.id) as { password_hash: string; password_salt: string };
    if (!database.verifyPassword(input.currentPassword, user.password_hash, user.password_salt)) {
      response.status(400).json({ code: "INVALID_PASSWORD", message: "La contraseña actual no es correcta." } satisfies ApiErrorResponse);
      return;
    }
    if (input.currentPassword === input.newPassword) {
      response.status(400).json({ code: "PASSWORD_REUSED", message: "La nueva contraseña debe ser diferente de la actual." } satisfies ApiErrorResponse);
      return;
    }
    const password = database.createPassword(input.newPassword);
    database.connection.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?")
      .run(password.hash, password.salt, new Date().toISOString(), request.identity!.id);
    audit(database, request.identity!, "CAMBIAR_CONTRASENA", "users", request.identity!.id, request.identity!.companyId, "El usuario actualizó su contraseña.");
    response.json({ message: "Contraseña actualizada correctamente." });
  });

  app.post("/api/users", requirePermission("USUARIOS:CREAR"), (request: AuthenticatedRequest, response: Response) => {
    const input = z.object({ company_id: positiveId.nullable(), username: text(3, 80), full_name: text(3, 160), email: emailField, role_ids: z.array(positiveId).min(1), active: activeField }).parse(request.body);
    if (input.company_id) {
      validateCompanyAccess(request.identity!, input.company_id);
      ensureActiveCompany(database, input.company_id);
    }
    ensureActiveRoles(database, input.role_ids);
    const id = database.createLocalUser({ companyId: input.company_id, username: input.username, fullName: input.full_name, email: input.email, roleIds: input.role_ids, active: input.active !== false && input.active !== 0 });
    audit(database, request.identity!, "CREAR", "users", id, input.company_id, `Usuario ${input.username} creado.`, undefined, { username: input.username, company_id: input.company_id, role_ids: input.role_ids });
    response.status(201).json({ id, message: "Usuario creado correctamente. La clave inicial debe cambiarse en el primer acceso." });
  });
}
