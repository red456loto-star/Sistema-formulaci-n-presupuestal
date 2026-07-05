import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";

export interface MasterContext {
  companyId: number;
  exerciseId: number;
  versionId: number;
  version: Record<string, unknown>;
  exercise: Record<string, unknown>;
}

export function numericId(value: unknown, label: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) httpError(`Seleccione ${label}.`, 400);
  return id;
}

export function getMasterContext(
  database: DatabaseManager,
  companyId: number,
  exerciseId: number,
  versionId: number,
  editable = false,
): MasterContext {
  const exercise = database.connection.prepare("SELECT * FROM budget_exercises WHERE id=? AND company_id=?")
    .get(exerciseId, companyId) as Record<string, unknown> | undefined;
  if (!exercise) httpError("El ejercicio no pertenece a la empresa activa.", 400);

  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=?")
    .get(versionId) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión seleccionada no existe.", 404);
  if (Number(version.company_id) !== companyId || Number(version.exercise_id) !== exerciseId) {
    httpError("La versión no pertenece a la empresa y ejercicio activos.", 400);
  }
  if (String(version.version_type) !== "ORIGINAL") {
    httpError("El presupuesto maestro de esta fase utiliza una versión ORIGINAL.", 400);
  }
  if (version.period_id !== null && version.period_id !== undefined) {
    httpError("El presupuesto maestro requiere una versión de alcance anual.", 400);
  }
  if (editable && String(version.status) !== "BORRADOR") {
    httpError("La versión está aprobada, cerrada o reemplazada y solo admite consulta.", 409);
  }
  return { companyId, exerciseId, versionId, version, exercise };
}

export function ensurePeriod(
  database: DatabaseManager,
  context: MasterContext,
  periodId: number,
  editable = false,
) {
  const period = database.connection.prepare("SELECT * FROM budget_periods WHERE id=? AND company_id=? AND exercise_id=?")
    .get(periodId, context.companyId, context.exerciseId) as Record<string, unknown> | undefined;
  if (!period) httpError("El periodo no pertenece al ejercicio activo.", 400);
  if (editable && String(period.status) === "CERRADO") {
    httpError(`El periodo ${String(period.name)} está cerrado y no puede modificarse.`, 409);
  }
  return period;
}

export function ensureItem(
  database: DatabaseManager,
  companyId: number,
  itemId: number,
  expectedType?: "PRODUCTO" | "MATERIAL",
) {
  const item = database.connection.prepare("SELECT * FROM master_items WHERE id=? AND company_id=? AND active=1")
    .get(itemId, companyId) as Record<string, unknown> | undefined;
  if (!item) httpError("El producto o material no pertenece a la empresa activa o está inactivo.", 400);
  if (expectedType && String(item.item_type) !== expectedType) {
    httpError(expectedType === "PRODUCTO" ? "Seleccione un registro de tipo PRODUCTO." : "Seleccione un registro de tipo MATERIAL.", 400);
  }
  return item;
}

export function ensureCenterAccount(
  database: DatabaseManager,
  companyId: number,
  centerId: number,
  accountId: number,
) {
  const row = database.connection.prepare(`SELECT c.id center_id,c.center_type,a.id account_id,
    a.code account_code,a.name account_name,e.id element_id,e.code element_code,e.name element_name,
    g.id group_id,g.code group_code,g.name group_name
    FROM activity_centers c
    JOIN center_accounts ca ON ca.center_id=c.id AND ca.active=1
    JOIN budget_accounts a ON a.id=ca.account_id AND a.active=1
    JOIN budget_elements e ON e.id=a.element_id AND e.active=1
    JOIN budget_groups g ON g.id=e.group_id AND g.active=1
    WHERE c.id=? AND a.id=? AND c.company_id=? AND a.company_id=? AND c.active=1`)
    .get(centerId, accountId, companyId, companyId) as Record<string, unknown> | undefined;
  if (!row) httpError("La cuenta no está habilitada para el centro o no pertenece a la empresa activa.", 400);
  return row;
}

export function ensureUnit(database: DatabaseManager, unitId: number | null | undefined) {
  if (unitId === null || unitId === undefined) return;
  if (!database.connection.prepare("SELECT id FROM units_of_measure WHERE id=? AND active=1").get(unitId)) {
    httpError("La unidad de medida no existe o está inactiva.", 400);
  }
}

export function roundAmount(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function optionalText(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
}

export function getPeriods(database: DatabaseManager, context: MasterContext) {
  const rows = database.connection.prepare("SELECT * FROM budget_periods WHERE company_id=? AND exercise_id=? ORDER BY period_number")
    .all(context.companyId, context.exerciseId) as Array<Record<string, unknown>>;
  if (rows.length !== 12) httpError("El ejercicio debe contener exactamente doce periodos.", 409);
  return rows;
}
