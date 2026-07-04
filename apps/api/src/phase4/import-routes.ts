import type { Express } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { registerInspectRoutes } from "./inspect-routes";
import { registerConfirmRoutes } from "./confirm-routes";
import { registerHistoryRoutes } from "./history-routes";

export function registerImportRoutes(app: Express, database: DatabaseManager) {
  registerInspectRoutes(app, database);
  registerConfirmRoutes(app, database);
  registerHistoryRoutes(app, database);
}
