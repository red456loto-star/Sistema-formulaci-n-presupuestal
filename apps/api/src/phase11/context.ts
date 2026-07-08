import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { seedBudgetTypes } from "./schema";

export interface Phase11ContextInput {
  company_id: number;
  exercise_id: number;
  period_id: number;
  version_id: number;
  budget_type_id: number;
}

export type PartialPhase11Context = {
  [Key in keyof Phase11ContextInput]?: number | null;
};

export function ensurePhase11Context(database: DatabaseManager, input: Phase11ContextInput) {
  const company = database.connection.prepare("SELECT * FROM companies WHERE id=? AND active=1").get(input.company_id) as Record<string, unknown> | undefined;
  if (!company) httpError("Seleccione una empresa activa.", 400);
  const exercise = database.connection.prepare("SELECT * FROM budget_exercises WHERE id=? AND company_id=? AND active=1")
    .get(input.exercise_id, input.company_id) as Record<string, unknown> | undefined;
  if (!exercise) httpError("El ejercicio no pertenece a la empresa seleccionada.", 400);
  const period = database.connection.prepare("SELECT * FROM budget_periods WHERE id=? AND company_id=? AND exercise_id=?")
    .get(input.period_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!period) httpError("El periodo no pertenece al ejercicio seleccionado.", 400);
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?")
    .get(input.version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece a la empresa y ejercicio seleccionados.", 400);
  if (version.period_id !== null && version.period_id !== undefined && Number(version.period_id) !== input.period_id) {
    httpError("La versión seleccionada está asociada a otro periodo.", 400);
  }
  seedBudgetTypes(database, input.company_id);
  const budgetType = database.connection.prepare("SELECT * FROM budget_types WHERE id=? AND company_id=? AND active=1")
    .get(input.budget_type_id, input.company_id) as Record<string, unknown> | undefined;
  if (!budgetType) httpError("El tipo de presupuesto no pertenece a la empresa o está inactivo.", 400);
  return { company, exercise, period, version, budgetType };
}

export function workflowStatus(database: DatabaseManager, partial: PartialPhase11Context) {
  const companyReady = Boolean(partial.company_id && database.connection.prepare("SELECT id FROM companies WHERE id=? AND active=1").get(partial.company_id));
  const exerciseReady = Boolean(companyReady && partial.exercise_id && database.connection.prepare("SELECT id FROM budget_exercises WHERE id=? AND company_id=? AND active=1").get(partial.exercise_id, partial.company_id));
  const periodReady = Boolean(exerciseReady && partial.period_id && database.connection.prepare("SELECT id FROM budget_periods WHERE id=? AND company_id=? AND exercise_id=?").get(partial.period_id, partial.company_id, partial.exercise_id));
  const versionReady = Boolean(exerciseReady && partial.version_id && database.connection.prepare("SELECT id FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?").get(partial.version_id, partial.company_id, partial.exercise_id));
  if (partial.company_id) seedBudgetTypes(database, partial.company_id);
  const budgetTypeReady = Boolean(versionReady && periodReady && partial.budget_type_id && database.connection.prepare("SELECT id FROM budget_types WHERE id=? AND company_id=? AND active=1").get(partial.budget_type_id, partial.company_id));
  const contextReady = companyReady && exerciseReady && periodReady && versionReady && budgetTypeReady;
  let budgetedRows = 0;
  let realRows = 0;
  let financialRows = 0;
  let costRows = 0;
  if (contextReady) {
    const values = database.connection.prepare(`SELECT
      SUM(CASE WHEN data_kind='PRESUPUESTADO' THEN 1 ELSE 0 END) budgeted_rows,
      SUM(CASE WHEN data_kind='REAL' THEN 1 ELSE 0 END) real_rows,
      SUM(CASE WHEN statement_section IN ('ESTADO_RESULTADOS','ESTADO_SITUACION','FLUJO_EFECTIVO') OR financial_item IS NOT NULL THEN 1 ELSE 0 END) financial_rows,
      SUM(CASE WHEN account_nature IN ('COSTO','GASTO') OR cost_behavior IN ('FIJO','VARIABLE') OR cost_traceability IN ('DIRECTO','INDIRECTO') THEN 1 ELSE 0 END) cost_rows
      FROM master_data_rows WHERE company_id=? AND exercise_id=? AND period_id=? AND version_id=? AND budget_type_id=?`)
      .get(partial.company_id, partial.exercise_id, partial.period_id, partial.version_id, partial.budget_type_id) as Record<string, unknown>;
    budgetedRows = Number(values.budgeted_rows ?? 0);
    realRows = Number(values.real_rows ?? 0);
    financialRows = Number(values.financial_rows ?? 0);
    costRows = Number(values.cost_rows ?? 0);
  }
  const masterDataReady = budgetedRows + realRows > 0;
  return {
    company_ready: companyReady,
    exercise_ready: exerciseReady,
    period_ready: periodReady,
    version_ready: versionReady,
    period_version_ready: periodReady && versionReady,
    budget_type_ready: budgetTypeReady,
    context_ready: contextReady,
    master_data_ready: masterDataReady,
    budgeted_ready: budgetedRows > 0,
    real_ready: realRows > 0,
    comparison_ready: budgetedRows > 0 && realRows > 0,
    financial_data_ready: financialRows > 0,
    cost_data_ready: costRows > 0,
    counts: { budgeted_rows: budgetedRows, real_rows: realRows, financial_rows: financialRows, cost_rows: costRows },
    next_required: !companyReady ? "EMPRESA" : !exerciseReady || !periodReady || !versionReady ? "PERIODO_VERSION" : !budgetTypeReady ? "TIPO_PRESUPUESTO" : !masterDataReady ? "TABLAS_MAESTRAS" : null,
  };
}
