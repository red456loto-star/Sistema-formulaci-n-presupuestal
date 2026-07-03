import type { Express, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { requirePermission, type AuthenticatedRequest, validateCompanyAccess } from "./common";

export function registerOrganizationRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/organization/hierarchy", requirePermission("ESTRUCTURA:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId = Number(request.query.company_id || request.identity!.companyId);
    if (!companyId) { response.status(400).json({ code: "COMPANY_REQUIRED", message: "Seleccione una empresa." }); return; }
    validateCompanyAccess(request.identity!, companyId);
    const company = database.connection.prepare("SELECT id, code, commercial_name, legal_name FROM companies WHERE id = ?").get(companyId);
    const sites = database.connection.prepare("SELECT * FROM sites WHERE company_id = ? ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    const centers = database.connection.prepare(`SELECT c.*, s.name AS site_name, r.full_name AS responsible_name, r.email AS responsible_email
      FROM activity_centers c JOIN sites s ON s.id = c.site_id LEFT JOIN responsibles r ON r.id = c.responsible_id
      WHERE c.company_id = ? ORDER BY c.code`).all(companyId) as Array<Record<string, unknown>>;
    const groups = database.connection.prepare("SELECT * FROM budget_groups WHERE company_id = ? ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    const elements = database.connection.prepare("SELECT * FROM budget_elements WHERE company_id = ? ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    const accounts = database.connection.prepare("SELECT * FROM budget_accounts WHERE company_id = ? ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    response.json({
      company,
      organizational: sites.map((site) => ({ ...site, centers: centers.filter((center) => center.site_id === site.id) })),
      budget: groups.map((group) => ({ ...group, elements: elements.filter((element) => element.group_id === group.id).map((element) => ({ ...element, accounts: accounts.filter((account) => account.element_id === element.id) })) })),
    });
  });

  app.get("/api/audit", requirePermission("AUDITORIA:LEER"), (request: AuthenticatedRequest, response: Response) => {
    const companyId = request.query.company_id ? Number(request.query.company_id) : request.identity!.companyId;
    if (companyId) validateCompanyAccess(request.identity!, companyId);
    const limit = Math.min(Number(request.query.limit || 100), 500);
    const where = companyId ? "WHERE a.company_id = ? OR a.company_id IS NULL" : "";
    const rows = database.connection.prepare(`SELECT a.*, u.full_name AS user_name, c.commercial_name AS company_name
      FROM audit_events a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN companies c ON c.id = a.company_id
      ${where} ORDER BY a.created_at DESC LIMIT ?`).all(...(companyId ? [companyId, limit] : [limit]));
    response.json(rows);
  });
}
