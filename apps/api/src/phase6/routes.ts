import type { Express } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { registerMasterDataRoutes } from "./data-routes";
import { registerMasterReportRoutes } from "./report-routes";

export function registerMasterBudgetRoutes(app: Express, database: DatabaseManager) {
  registerMasterDataRoutes(app, database);
  registerMasterReportRoutes(app, database);
}
