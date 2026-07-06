import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";

export interface Phase7Context {
  companyId: number;
  exerciseId: number;
  originalVersionId: number;
  exercise: Record<string, unknown>;
  originalVersion: Record<string, unknown>;
}

export function numericId(value: unknown, label: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) httpError(`Seleccione ${label}.`, 400);
  return id;
}

export function getPhase7Context(
  database: DatabaseManager,
  companyId: number,
  exerciseId: number,
  originalVersionId: number,
  requireApprovedOriginal = false,
): Phase7Context {
  const exercise = database.connection.prepare("SELECT * FROM budget_exercises WHERE id=? AND company_id=?")
    .get(exerciseId, companyId) as Record<string, unknown> | undefined;
  if (!exercise) httpError("El ejercicio no pertenece a la empresa activa.", 400);

  const originalVersion = database.connection.prepare("SELECT * FROM budget_versions WHERE id=?")
    .get(originalVersionId) as Record<string, unknown> | undefined;
  if (!originalVersion) httpError("La versión original no existe.", 404);
  if (Number(originalVersion.company_id) !== companyId || Number(originalVersion.exercise_id) !== exerciseId) {
    httpError("La versión original no pertenece a la empresa y ejercicio activos.", 400);
  }
  if (String(originalVersion.version_type) !== "ORIGINAL") {
    httpError("Seleccione una versión de tipo ORIGINAL.", 400);
  }
  if (requireApprovedOriginal && !["APROBADO", "CERRADO"].includes(String(originalVersion.status))) {
    httpError("La versión original debe estar aprobada o cerrada antes de crear un forecast.", 409);
  }
  return { companyId, exerciseId, originalVersionId, exercise, originalVersion };
}

export function ensureEditablePeriod(
  database: DatabaseManager,
  context: Phase7Context,
  periodId: number,
) {
  const period = database.connection.prepare("SELECT * FROM budget_periods WHERE id=? AND company_id=? AND exercise_id=?")
    .get(periodId, context.companyId, context.exerciseId) as Record<string, unknown> | undefined;
  if (!period) httpError("El periodo no pertenece al ejercicio activo.", 400);
  if (String(period.status) === "CERRADO") {
    httpError(`El periodo ${String(period.name)} está cerrado y no puede modificarse.`, 409);
  }
  return period;
}

export function ensurePeriod(
  database: DatabaseManager,
  context: Phase7Context,
  periodId: number,
) {
  const period = database.connection.prepare("SELECT * FROM budget_periods WHERE id=? AND company_id=? AND exercise_id=?")
    .get(periodId, context.companyId, context.exerciseId) as Record<string, unknown> | undefined;
  if (!period) httpError("El periodo no pertenece al ejercicio activo.", 400);
  return period;
}

export function ensureDimensions(
  database: DatabaseManager,
  companyId: number,
  centerId: number,
  accountId: number,
) {
  const row = database.connection.prepare(`SELECT c.id center_id,c.code center_code,c.name center_name,
    a.id account_id,a.code account_code,a.name account_name,a.nature account_nature,
    e.id element_id,e.code element_code,e.name element_name,
    g.id group_id,g.code group_code,g.name group_name
    FROM activity_centers c
    JOIN center_accounts ca ON ca.center_id=c.id AND ca.active=1
    JOIN budget_accounts a ON a.id=ca.account_id AND a.active=1
    JOIN budget_elements e ON e.id=a.element_id AND e.active=1
    JOIN budget_groups g ON g.id=e.group_id AND g.active=1
    WHERE c.id=? AND a.id=? AND c.company_id=? AND a.company_id=? AND c.active=1`)
    .get(centerId, accountId, companyId, companyId) as Record<string, unknown> | undefined;
  if (!row) httpError("La cuenta no está habilitada para el centro o pertenece a otra empresa.", 400);
  return row;
}

export function ensureResponsible(
  database: DatabaseManager,
  companyId: number,
  responsibleId: number | null | undefined,
  required = false,
) {
  if (!responsibleId) {
    if (required) httpError("Seleccione un responsable.", 400);
    return null;
  }
  const row = database.connection.prepare("SELECT * FROM responsibles WHERE id=? AND company_id=? AND active=1")
    .get(responsibleId, companyId) as Record<string, unknown> | undefined;
  if (!row) httpError("El responsable no pertenece a la empresa activa o está inactivo.", 400);
  return row;
}

export function optionalText(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
}

export function roundAmount(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function getForecastVersion(database: DatabaseManager, versionId: number, editable = false) {
  const row = database.connection.prepare(`SELECT v.*,fp.cutoff_period_number,fp.original_version_id,
    fp.revision_number,fp.observation,source.code source_version_code,source.status source_version_status,
    r.full_name responsible_name
    FROM budget_versions v
    JOIN forecast_profiles fp ON fp.forecast_version_id=v.id
    JOIN budget_versions source ON source.id=fp.original_version_id
    LEFT JOIN responsibles r ON r.id=v.responsible_id
    WHERE v.id=? AND v.version_type='FORECAST'`).get(versionId) as Record<string, unknown> | undefined;
  if (!row) httpError("La versión forecast no existe.", 404);
  if (editable && String(row.status) !== "BORRADOR") {
    httpError("La versión forecast está aprobada, cerrada o reemplazada y solo admite consulta.", 409);
  }
  return row;
}

export function addVersionHistory(
  database: DatabaseManager,
  version: Record<string, unknown>,
  fromStatus: string | null,
  toStatus: string,
  responsibleId: number | null,
  notes: string | null,
) {
  database.connection.prepare(`INSERT INTO version_status_history
    (company_id,version_id,from_status,to_status,responsible_id,notes,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(
    version.company_id,
    version.id,
    fromStatus,
    toStatus,
    responsibleId,
    notes,
    new Date().toISOString(),
  );
}
