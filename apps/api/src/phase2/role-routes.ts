import type { Express } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { requirePermission } from "./common";

export function registerRoleRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/roles", requirePermission("USUARIOS:LEER"), (_request, response) => {
    response.json(database.connection.prepare("SELECT id, code, name, description, active FROM roles ORDER BY name").all());
  });
  app.get("/api/permissions", requirePermission("USUARIOS:LEER"), (_request, response) => {
    response.json(database.connection.prepare("SELECT id, code, module, action, description FROM permissions ORDER BY module, action").all());
  });
}
