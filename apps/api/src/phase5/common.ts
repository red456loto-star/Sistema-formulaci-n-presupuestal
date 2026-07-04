import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";

export function getOriginalVersion(database: DatabaseManager, versionId: number, companyId: number, exerciseId: number, editable = false) {
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=?").get(versionId) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión seleccionada no existe.", 404);
  if (Number(version.company_id) !== companyId || Number(version.exercise_id) !== exerciseId) httpError("La versión no pertenece a la empresa y ejercicio activos.");
  if (String(version.version_type) !== "ORIGINAL") httpError("Seleccione una versión de tipo ORIGINAL.");
  if (editable && String(version.status) !== "BORRADOR") httpError("La versión está aprobada, cerrada o reemplazada y solo admite consulta.", 409);
  return version;
}

export function getOriginalLine(database: DatabaseManager, lineId: number) {
  const line = database.connection.prepare("SELECT * FROM budget_original_lines WHERE id=?").get(lineId) as Record<string, unknown> | undefined;
  if (!line) httpError("La línea presupuestal no existe.", 404);
  return line;
}

export function ensureEditableLine(database: DatabaseManager, lineId: number) {
  const line = getOriginalLine(database, lineId);
  getOriginalVersion(database, Number(line.version_id), Number(line.company_id), Number(line.exercise_id), true);
  return line;
}

export function getPeriods(database: DatabaseManager, companyId: number, exerciseId: number) {
  const rows = database.connection.prepare("SELECT * FROM budget_periods WHERE company_id=? AND exercise_id=? ORDER BY period_number").all(companyId, exerciseId) as Array<Record<string, unknown>>;
  if (rows.length !== 12) httpError("El ejercicio debe contener exactamente doce periodos mensuales.", 409);
  return rows;
}

export function getProjectionYears(database: DatabaseManager, companyId: number, exerciseId: number) {
  const rows = database.connection.prepare("SELECT * FROM projection_years WHERE company_id=? AND exercise_id=? AND active=1 ORDER BY sequence").all(companyId, exerciseId) as Array<Record<string, unknown>>;
  if (rows.length !== 3) httpError("El ejercicio debe contener los tres años de proyección.", 409);
  return rows;
}

export function resolveDimensions(database: DatabaseManager, companyId: number, centerId: number, accountId: number, currencyId: number, unitId?: number | null, responsibleId?: number | null) {
  const center = database.connection.prepare("SELECT * FROM activity_centers WHERE id=? AND company_id=? AND active=1").get(centerId, companyId) as Record<string, unknown> | undefined;
  if (!center) httpError("El centro no pertenece a la empresa activa o está inactivo.");

  const account = database.connection.prepare(`SELECT a.*, e.group_id, e.id AS resolved_element_id
    FROM budget_accounts a JOIN budget_elements e ON e.id=a.element_id
    JOIN budget_groups g ON g.id=e.group_id
    WHERE a.id=? AND a.company_id=? AND a.active=1 AND e.active=1 AND g.active=1`).get(accountId, companyId) as Record<string, unknown> | undefined;
  if (!account) httpError("La cuenta no pertenece a la empresa activa o su estructura está inactiva.");

  const assignment = database.connection.prepare("SELECT 1 FROM center_accounts WHERE center_id=? AND account_id=? AND active=1").get(centerId, accountId);
  if (!assignment) httpError("La cuenta no está habilitada para el centro seleccionado.");

  const currency = database.connection.prepare("SELECT id, decimals FROM currencies WHERE id=? AND active=1").get(currencyId) as { id: number; decimals: number } | undefined;
  if (!currency) httpError("La moneda seleccionada no existe o está inactiva.");

  if (unitId && !database.connection.prepare("SELECT id FROM units_of_measure WHERE id=? AND active=1").get(unitId)) httpError("La unidad de medida no existe o está inactiva.");
  if (responsibleId && !database.connection.prepare("SELECT id FROM responsibles WHERE id=? AND company_id=? AND active=1").get(responsibleId, companyId)) httpError("El responsable no pertenece a la empresa activa o está inactivo.");

  return {
    groupId: Number(account.group_id),
    elementId: Number(account.resolved_element_id),
    currencyDecimals: Number(currency.decimals),
  };
}

export function roundValue(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function nullableNumber(value: unknown) {
  return value === null || value === undefined || value === "" ? null : Number(value);
}
