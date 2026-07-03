import type { Express, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import type { ApiErrorResponse } from "../../../../packages/shared/src/index";
import { audit, type AuthenticatedRequest, text } from "./common";

export function registerPublicAuthRoutes(app: Express, database: DatabaseManager) {
  app.post("/api/auth/login", (request, response) => {
    const input = z.object({ username: text(2, 80), password: z.string().min(8).max(200) }).parse(request.body);
    const user = database.connection.prepare(`SELECT id, username, full_name, email, company_id, password_hash, password_salt, active
      FROM users WHERE lower(username) = lower(?)`).get(input.username) as Record<string, unknown> | undefined;
    if (!user || !Boolean(user.active) || !database.verifyPassword(input.password, String(user.password_hash), String(user.password_salt))) {
      response.status(401).json({ code: "INVALID_CREDENTIALS", message: "Usuario o contraseña incorrectos." } satisfies ApiErrorResponse);
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
    const password = database.createPassword(input.newPassword);
    database.connection.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?")
      .run(password.hash, password.salt, new Date().toISOString(), request.identity!.id);
    audit(database, request.identity!, "CAMBIAR_CONTRASENA", "users", request.identity!.id, request.identity!.companyId, "El usuario actualizó su contraseña.");
    response.json({ message: "Contraseña actualizada correctamente." });
  });
}
