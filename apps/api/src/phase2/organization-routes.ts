import type { Express, Request, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { requireCompanyId } from "./common";

export function registerOrganizationRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/organization/hierarchy", (request: Request, response: Response) => {
    const companyId = requireCompanyId(request.query.company_id);
    if (!companyId) { response.status(400).json({ code: "COMPANY_REQUIRED", message: "Seleccione una empresa." }); return; }
    const company = database.connection.prepare("SELECT id, code, commercial_name, legal_name FROM companies WHERE id = ?").get(companyId) as Record<string, unknown> | undefined;
    if (!company) { response.status(404).json({ code: "NOT_FOUND", message: "Empresa no encontrada." }); return; }

    const sites = database.connection.prepare("SELECT * FROM sites WHERE company_id = ? AND active=1 ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    const centers = database.connection.prepare(`SELECT c.*, s.name AS site_name, r.full_name AS responsible_name, r.email AS responsible_email
      FROM activity_centers c JOIN sites s ON s.id = c.site_id JOIN responsibles r ON r.id = c.responsible_id
      WHERE c.company_id = ? AND c.active=1 AND s.active=1 AND r.active=1 ORDER BY c.code`).all(companyId) as Array<Record<string, unknown>>;
    const groups = database.connection.prepare("SELECT * FROM budget_groups WHERE company_id = ? AND active=1 ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    const elements = database.connection.prepare("SELECT * FROM budget_elements WHERE company_id = ? AND active=1 ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    const accounts = database.connection.prepare("SELECT * FROM budget_accounts WHERE company_id = ? AND active=1 ORDER BY code").all(companyId) as Array<Record<string, unknown>>;
    const assignments = database.connection.prepare(`SELECT ca.center_id, ca.account_id
      FROM center_accounts ca
      JOIN activity_centers c ON c.id=ca.center_id
      JOIN budget_accounts a ON a.id=ca.account_id
      WHERE c.company_id=? AND a.company_id=? AND ca.active=1`).all(companyId, companyId) as Array<{ center_id: number; account_id: number }>;

    const fullBudget = groups.map((group) => ({
      ...group,
      elements: elements.filter((element) => element.group_id === group.id).map((element) => ({
        ...element,
        accounts: accounts.filter((account) => account.element_id === element.id),
      })),
    }));

    const budgetForCenter = (centerId: number) => {
      const assignedIds = new Set(assignments.filter((item) => item.center_id === centerId).map((item) => item.account_id));
      return groups.map((group) => ({
        ...group,
        elements: elements
          .filter((element) => element.group_id === group.id)
          .map((element) => ({ ...element, accounts: accounts.filter((account) => account.element_id === element.id && assignedIds.has(Number(account.id))) }))
          .filter((element) => element.accounts.length > 0),
      })).filter((group) => group.elements.length > 0);
    };

    response.json({
      company,
      organizational: sites.map((site) => ({
        ...site,
        centers: centers.filter((center) => center.site_id === site.id).map((center) => ({ ...center, budget: budgetForCenter(Number(center.id)) })),
      })),
      budget: fullBudget,
    });
  });

}
