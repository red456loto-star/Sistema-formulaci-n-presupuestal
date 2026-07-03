import type { Express, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { requirePermission, type AuthenticatedRequest, validateCompanyAccess } from "./common";
import { registerUserMutationRoutes } from "./user-mutation-routes";

export function registerUserReadRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/users", requirePermission("USUARIOS:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId = request.query.company_id ? Number(request.query.company_id) : request.identity!.companyId;
    if (companyId) validateCompanyAccess(request.identity!, companyId);
    const where = companyId ? "WHERE u.company_id = ?" : "";
    const rows = database.connection.prepare(`SELECT u.id, u.company_id, c.commercial_name AS company_name,
      u.username, u.full_name, u.email, u.active, u.must_change_password, u.last_login_at, u.created_at,
      COALESCE(group_concat(r.code, ','), '') AS role_codes,
      COALESCE(group_concat(r.name, ', '), '') AS role_names
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      ${where}
      GROUP BY u.id ORDER BY u.full_name`).all(...(companyId ? [companyId] : []));
    response.json(rows);
  });
  registerUserMutationRoutes(app, database);
}
