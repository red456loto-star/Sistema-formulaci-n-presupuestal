import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { ensureCompanyExists } from "../phase2/common";

export const budgetYearField = z.coerce.number().int().min(2000).max(2200);
export const versionStatus = z.enum(["BORRADOR", "APROBADO", "CERRADO", "REEMPLAZADO"]);
export const versionType = z.enum(["ORIGINAL", "FORECAST"]);

export function httpError(message: string, statusCode = 400): never {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  throw error;
}

export function annualDates(year: number) {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export function monthDates(year: number, month: number) {
  const monthText = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${monthText}-01`,
    endDate: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

export const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

export function ensureExercise(database: DatabaseManager, exerciseId: number, companyId?: number) {
  const row = database.connection.prepare("SELECT * FROM budget_exercises WHERE id = ?").get(exerciseId) as Record<string, unknown> | undefined;
  if (!row) httpError("El ejercicio seleccionado no existe.", 404);
  if (companyId && Number(row.company_id) !== companyId) httpError("El ejercicio no pertenece a la empresa activa.");
  return row;
}

export function ensurePeriod(database: DatabaseManager, periodId: number, exerciseId: number, companyId: number) {
  const row = database.connection.prepare("SELECT * FROM budget_periods WHERE id = ?").get(periodId) as Record<string, unknown> | undefined;
  if (!row) httpError("El periodo seleccionado no existe.", 404);
  if (Number(row.company_id) !== companyId || Number(row.exercise_id) !== exerciseId) httpError("El periodo no pertenece al ejercicio y empresa seleccionados.");
  return row;
}

export function ensureResponsible(database: DatabaseManager, responsibleId: number | null | undefined, companyId: number, required = false) {
  if (!responsibleId) {
    if (required) httpError("Seleccione un responsable para registrar esta acción.");
    return null;
  }
  const row = database.connection.prepare("SELECT id FROM responsibles WHERE id = ? AND company_id = ? AND active = 1").get(responsibleId, companyId);
  if (!row) httpError("El responsable no pertenece a la empresa activa o está inactivo.");
  return Number(responsibleId);
}

export function ensureCurrency(database: DatabaseManager, currencyId: number) {
  const row = database.connection.prepare("SELECT id FROM currencies WHERE id = ? AND active = 1").get(currencyId);
  if (!row) httpError("La moneda seleccionada no existe o está inactiva.");
}

export function ensureTemporalCompany(database: DatabaseManager, companyId: number) {
  ensureCompanyExists(database, companyId, true);
}
