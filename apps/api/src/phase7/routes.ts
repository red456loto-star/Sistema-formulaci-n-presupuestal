import type { Express } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { registerActualRoutes } from "./actual-routes";
import { registerForecastRoutes } from "./forecast-routes";

export function registerPhase7Routes(app: Express, database: DatabaseManager) {
  registerActualRoutes(app, database);
  registerForecastRoutes(app, database);
}
