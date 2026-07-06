import type { Express, NextFunction, Request, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";

interface DescriptorLike {
  company_id?: unknown;
  exercise_id?: unknown;
  version_id?: unknown;
  source_type?: unknown;
  period_number?: unknown;
}

function ensurePeriodData(database: DatabaseManager, descriptor: DescriptorLike) {
  const companyId = Number(descriptor.company_id);
  const exerciseId = Number(descriptor.exercise_id);
  const versionId = Number(descriptor.version_id);
  const sourceType = String(descriptor.source_type ?? "");
  const periodNumber = descriptor.period_number === null || descriptor.period_number === undefined || descriptor.period_number === ""
    ? null
    : Number(descriptor.period_number);

  if (periodNumber === null || sourceType === "ORIGINAL") return;
  if (!Number.isInteger(companyId) || !Number.isInteger(exerciseId) || !Number.isInteger(versionId) || !Number.isInteger(periodNumber)) return;

  const period = database.connection.prepare("SELECT id,name FROM budget_periods WHERE company_id=? AND exercise_id=? AND period_number=?")
    .get(companyId, exerciseId, periodNumber) as { id: number; name: string } | undefined;
  if (!period) httpError("El periodo seleccionado no pertenece al ejercicio activo.", 400);

  const row = sourceType === "REAL"
    ? database.connection.prepare("SELECT id FROM actual_values WHERE company_id=? AND exercise_id=? AND original_version_id=? AND period_id=? LIMIT 1")
      .get(companyId, exerciseId, versionId, period.id)
    : sourceType === "FORECAST"
      ? database.connection.prepare("SELECT id FROM forecast_values WHERE company_id=? AND exercise_id=? AND forecast_version_id=? AND period_id=? LIMIT 1")
        .get(companyId, exerciseId, versionId, period.id)
      : undefined;

  if (!row) {
    httpError(`No existe información ${sourceType === "REAL" ? "real" : "forecast"} para el periodo ${period.name}.`, 409);
  }
}

export function registerFinancialAnalysisContextGuard(app: Express, database: DatabaseManager) {
  const queryGuard = (request: Request, _response: Response, next: NextFunction) => {
    ensurePeriodData(database, request.query);
    next();
  };

  app.get("/api/financial-analysis/report", queryGuard);
  app.get("/api/financial-analysis/export", queryGuard);
  app.post("/api/financial-analysis/horizontal", (request: Request, _response: Response, next: NextFunction) => {
    const body = request.body as { initial?: DescriptorLike; final?: DescriptorLike };
    if (body.initial) ensurePeriodData(database, body.initial);
    if (body.final) ensurePeriodData(database, body.final);
    next();
  });
}
