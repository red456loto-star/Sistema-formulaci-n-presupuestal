import type { Express } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { registerActualRoutes } from "./actual-routes";
import { registerForecastRoutes } from "./forecast-routes";
import { registerPhase7ContextGuard } from "./context-guard";

export function registerPhase7Routes(app: Express, database: DatabaseManager) {
  registerActualRoutes(app, database);
  registerPhase7ContextGuard(app, database);
  registerForecastRoutes(app, database);
}
