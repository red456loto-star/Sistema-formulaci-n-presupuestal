import type { Express, Request, Response, NextFunction } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";

export function registerPhase7ContextGuard(app: Express, database: DatabaseManager) {
  app.get("/api/forecasts", (request: Request, _response: Response, next: NextFunction) => {
    const companyId = Number(request.query.company_id);
    const exerciseId = Number(request.query.exercise_id);

    if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(exerciseId) || exerciseId <= 0) {
      next();
      return;
    }

    const exercise = database.connection
      .prepare("SELECT id FROM budget_exercises WHERE id=? AND company_id=?")
      .get(exerciseId, companyId);

    if (!exercise) {
      httpError("El ejercicio no pertenece a la empresa activa.", 400);
    }

    next();
  });
}
