import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { buildPhase9Analysis, type Phase9Input } from "../phase9/calculations";

export type ProposalPriority = "ALTA" | "MEDIA" | "BAJA";
export type ProposalStatus = "PROPUESTA" | "APROBADA" | "EN_EJECUCION" | "IMPLEMENTADA" | "DESCARTADA";
export type ProposalSource = "ORIGINAL" | "FORECAST" | "VARIACION" | "COSTOS" | "DASHBOARD";

export interface ProposalInput {
  company_id: number;
  exercise_id: number;
  period_id?: number | null;
  version_id: number;
  center_id?: number | null;
  element_id?: number | null;
  account_id?: number | null;
  source_type: ProposalSource;
  problem: string;
  evidence_value: number;
  evidence_unit: string;
  evidence_text: string;
  probable_cause: string;
  proposed_action: string;
  expected_impact: number;
  profitability_impact?: number | null;
  responsible_id: number;
  priority: ProposalPriority;
  due_date: string;
  status?: ProposalStatus;
}

function getRecord(database: DatabaseManager, table: string, id: number, companyId: number) {
  return database.connection.prepare(`SELECT * FROM ${table} WHERE id=? AND company_id=?`).get(id, companyId) as Record<string, unknown> | undefined;
}

function ensureProposalContext(database: DatabaseManager, input: ProposalInput) {
  const company = database.connection.prepare("SELECT * FROM companies WHERE id=? AND active=1").get(input.company_id);
  if (!company) httpError("La empresa seleccionada no existe o está inactiva.", 400);
  const exercise = database.connection.prepare("SELECT * FROM budget_exercises WHERE id=? AND company_id=?").get(input.exercise_id, input.company_id) as Record<string, unknown> | undefined;
  if (!exercise) httpError("El ejercicio no pertenece a la empresa seleccionada.", 400);
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?")
    .get(input.version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece a la empresa y ejercicio seleccionados.", 400);
  if (input.period_id) {
    const period = database.connection.prepare("SELECT id FROM budget_periods WHERE id=? AND company_id=? AND exercise_id=?")
      .get(input.period_id, input.company_id, input.exercise_id);
    if (!period) httpError("El periodo no pertenece al ejercicio seleccionado.", 400);
  }
  if (input.center_id && !getRecord(database, "activity_centers", input.center_id, input.company_id)) httpError("El centro no pertenece a la empresa seleccionada.", 400);
  if (input.element_id && !getRecord(database, "budget_elements", input.element_id, input.company_id)) httpError("El elemento no pertenece a la empresa seleccionada.", 400);
  if (input.account_id) {
    const account = getRecord(database, "budget_accounts", input.account_id, input.company_id);
    if (!account) httpError("La cuenta no pertenece a la empresa seleccionada.", 400);
    if (input.element_id && Number(account.element_id) !== input.element_id) httpError("La cuenta no pertenece al elemento indicado.", 400);
  }
  const responsible = getRecord(database, "responsibles", input.responsible_id, input.company_id);
  if (!responsible || !Number(responsible.active)) httpError("El responsable no pertenece a la empresa o está inactivo.", 400);
  if (!Number.isFinite(input.evidence_value)) httpError("La propuesta debe incluir evidencia cuantitativa válida.", 400);
  if (!input.evidence_text.trim()) httpError("La propuesta debe explicar la evidencia cuantitativa.", 400);
  return { exercise, version, responsible };
}

function proposalDetail(database: DatabaseManager, id: number) {
  const row = database.connection.prepare(`SELECT ip.*,c.code center_code,c.name center_name,e.code element_code,e.name element_name,
      a.code account_code,a.name account_name,r.full_name responsible_name,r.position responsible_position,
      v.code version_code,v.name version_name,v.version_type,v.status version_status,p.period_number,p.name period_name
    FROM improvement_proposals ip
    LEFT JOIN activity_centers c ON c.id=ip.center_id LEFT JOIN budget_elements e ON e.id=ip.element_id
    LEFT JOIN budget_accounts a ON a.id=ip.account_id JOIN responsibles r ON r.id=ip.responsible_id
    JOIN budget_versions v ON v.id=ip.version_id LEFT JOIN budget_periods p ON p.id=ip.period_id WHERE ip.id=?`).get(id) as Record<string, unknown> | undefined;
  if (!row) httpError("La propuesta no existe.", 404);
  return row;
}

export function createProposal(database: DatabaseManager, input: ProposalInput) {
  ensureProposalContext(database, input);
  const stamp = new Date().toISOString();
  const id = Number(database.connection.prepare(`INSERT INTO improvement_proposals
    (company_id,exercise_id,period_id,version_id,center_id,element_id,account_id,source_type,problem,evidence_value,evidence_unit,
     evidence_text,probable_cause,proposed_action,expected_impact,profitability_impact,responsible_id,priority,due_date,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      input.company_id, input.exercise_id, input.period_id ?? null, input.version_id, input.center_id ?? null, input.element_id ?? null,
      input.account_id ?? null, input.source_type, input.problem.trim(), input.evidence_value, input.evidence_unit.trim(), input.evidence_text.trim(),
      input.probable_cause.trim(), input.proposed_action.trim(), input.expected_impact, input.profitability_impact ?? null,
      input.responsible_id, input.priority, input.due_date, input.status ?? "PROPUESTA", stamp, stamp,
    ).lastInsertRowid);
  return proposalDetail(database, id);
}

export function updateProposal(database: DatabaseManager, id: number, patch: Partial<Pick<ProposalInput,
  "problem" | "evidence_value" | "evidence_unit" | "evidence_text" | "probable_cause" | "proposed_action" |
  "expected_impact" | "profitability_impact" | "responsible_id" | "priority" | "due_date" | "status">>) {
  const before = proposalDetail(database, id);
  const merged: ProposalInput = {
    company_id: Number(before.company_id), exercise_id: Number(before.exercise_id), period_id: before.period_id ? Number(before.period_id) : null,
    version_id: Number(before.version_id), center_id: before.center_id ? Number(before.center_id) : null,
    element_id: before.element_id ? Number(before.element_id) : null, account_id: before.account_id ? Number(before.account_id) : null,
    source_type: String(before.source_type) as ProposalSource, problem: String(patch.problem ?? before.problem),
    evidence_value: Number(patch.evidence_value ?? before.evidence_value), evidence_unit: String(patch.evidence_unit ?? before.evidence_unit),
    evidence_text: String(patch.evidence_text ?? before.evidence_text), probable_cause: String(patch.probable_cause ?? before.probable_cause),
    proposed_action: String(patch.proposed_action ?? before.proposed_action), expected_impact: Number(patch.expected_impact ?? before.expected_impact),
    profitability_impact: patch.profitability_impact === undefined ? (before.profitability_impact === null ? null : Number(before.profitability_impact)) : patch.profitability_impact,
    responsible_id: Number(patch.responsible_id ?? before.responsible_id), priority: String(patch.priority ?? before.priority) as ProposalPriority,
    due_date: String(patch.due_date ?? before.due_date), status: String(patch.status ?? before.status) as ProposalStatus,
  };
  ensureProposalContext(database, merged);
  database.connection.prepare(`UPDATE improvement_proposals SET problem=?,evidence_value=?,evidence_unit=?,evidence_text=?,probable_cause=?,
    proposed_action=?,expected_impact=?,profitability_impact=?,responsible_id=?,priority=?,due_date=?,status=?,updated_at=? WHERE id=?`)
    .run(merged.problem.trim(), merged.evidence_value, merged.evidence_unit.trim(), merged.evidence_text.trim(), merged.probable_cause.trim(),
      merged.proposed_action.trim(), merged.expected_impact, merged.profitability_impact ?? null, merged.responsible_id, merged.priority,
      merged.due_date, merged.status, new Date().toISOString(), id);
  return proposalDetail(database, id);
}

export function listProposals(database: DatabaseManager, companyId: number, exerciseId: number, versionId?: number | null) {
  const exercise = database.connection.prepare("SELECT id FROM budget_exercises WHERE id=? AND company_id=?").get(exerciseId, companyId);
  if (!exercise) httpError("El ejercicio no pertenece a la empresa seleccionada.", 400);
  const versionClause = versionId ? " AND ip.version_id=?" : "";
  const params = versionId ? [companyId, exerciseId, versionId] : [companyId, exerciseId];
  return database.connection.prepare(`SELECT ip.*,c.code center_code,c.name center_name,e.code element_code,e.name element_name,
      a.code account_code,a.name account_name,r.full_name responsible_name,r.position responsible_position,
      v.code version_code,v.name version_name,v.version_type,v.status version_status,p.period_number,p.name period_name
    FROM improvement_proposals ip
    LEFT JOIN activity_centers c ON c.id=ip.center_id LEFT JOIN budget_elements e ON e.id=ip.element_id
    LEFT JOIN budget_accounts a ON a.id=ip.account_id JOIN responsibles r ON r.id=ip.responsible_id
    JOIN budget_versions v ON v.id=ip.version_id LEFT JOIN budget_periods p ON p.id=ip.period_id
    WHERE ip.company_id=? AND ip.exercise_id=?${versionClause}
    ORDER BY CASE ip.priority WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,ip.due_date,ip.id DESC`).all(...params);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function suggestionContext(database: DatabaseManager, companyId: number, exerciseId: number, versionId: number, periodNumber?: number | null, centerId?: number | null) {
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?")
    .get(versionId, companyId, exerciseId) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece a la empresa y ejercicio seleccionados.", 400);
  let originalVersionId = versionId;
  let forecastVersionId: number | null = null;
  let comparison: Phase9Input["comparison"] = "ORIGINAL_REAL";
  if (String(version.version_type) === "FORECAST") {
    const profile = database.connection.prepare("SELECT original_version_id FROM forecast_profiles WHERE forecast_version_id=?").get(versionId) as { original_version_id: number } | undefined;
    if (!profile) httpError("La versión forecast no tiene perfil asociado.", 409);
    originalVersionId = Number(profile.original_version_id);
    forecastVersionId = versionId;
    comparison = "ORIGINAL_FORECAST";
  }
  const input: Phase9Input = {
    company_id: companyId, exercise_id: exerciseId, original_version_id: originalVersionId,
    forecast_version_id: forecastVersionId, period_number: periodNumber ?? null, center_id: centerId ?? null,
    comparison, materiality_threshold: 5,
  };
  return { version, input };
}

export function suggestProposals(database: DatabaseManager, companyId: number, exerciseId: number, versionId: number, periodNumber?: number | null, centerId?: number | null) {
  const { version, input } = suggestionContext(database, companyId, exerciseId, versionId, periodNumber, centerId);
  const analysis = buildPhase9Analysis(database, input);
  const salesBase = analysis.variations.rows.filter((row) => row.account_nature === "INGRESO").reduce((sum, row) => sum + Math.abs(row.base_value), 0);
  const candidates = analysis.variations.rows
    .filter((row) => row.status === "DESFAVORABLE" && row.monetary_variation !== null && Math.abs(row.monetary_variation) > 0)
    .sort((left, right) => Math.abs(Number(right.monetary_variation)) - Math.abs(Number(left.monetary_variation)))
    .slice(0, 8);

  return candidates.map((row) => {
    const amount = Math.abs(Number(row.monetary_variation));
    const impactShare = row.variance_impact_percentage;
    const priority: ProposalPriority = impactShare >= 25 ? "ALTA" : impactShare >= 10 ? "MEDIA" : "BAJA";
    const responsible = database.connection.prepare(`SELECT r.id,r.full_name,r.position FROM activity_centers c JOIN responsibles r ON r.id=c.responsible_id
      WHERE c.id=? AND c.company_id=?`).get(row.center_id, companyId) as Record<string, unknown> | undefined;
    if (!responsible) httpError("El centro crítico no tiene un responsable empresarial válido.", 409);
    const isRevenue = row.account_nature === "INGRESO";
    const expectedImpact = Math.round(amount * 0.5 * 100) / 100;
    const profitabilityImpact = salesBase === 0 ? null : Math.round(expectedImpact / salesBase * 10000) / 100;
    const comparisonText = `${analysis.context.base_label} ${row.base_value.toFixed(2)} frente a ${analysis.context.comparison_label} ${Number(row.comparison_value).toFixed(2)}`;
    return {
      company_id: companyId,
      exercise_id: exerciseId,
      period_id: row.period_id,
      period_label: `${row.period_number} · ${row.period_name}`,
      version_id: versionId,
      version_code: version.code,
      center_id: row.center_id,
      center_label: `${row.center_code} · ${row.center_name}`,
      element_id: row.element_id,
      element_label: `${row.element_code} · ${row.element_name}`,
      account_id: row.account_id,
      account_label: `${row.account_code} · ${row.account_name}`,
      source_type: String(version.version_type) === "FORECAST" ? "FORECAST" : "VARIACION",
      problem: isRevenue ? `Caída desfavorable en ${row.account_name}` : `Sobreejecución desfavorable en ${row.account_name}`,
      evidence_value: amount,
      evidence_unit: analysis.context.currency_code,
      evidence_text: `${comparisonText}; desviación ${Number(row.percentage_variation ?? 0).toFixed(2)} %, participación ${row.variance_impact_percentage.toFixed(2)} % del impacto total.`,
      probable_cause: isRevenue
        ? "Menor nivel de ventas, volumen o precio respecto de la base presupuestada. La causa debe confirmarse con el responsable comercial."
        : "Mayor consumo, precio unitario o gasto respecto de la base presupuestada. La causa debe confirmarse con el responsable del centro.",
      proposed_action: isRevenue
        ? "Revisar el plan comercial, clientes, volumen y precios; definir acciones de recuperación y actualizar el forecast con sustento."
        : "Revisar consumos, precios, órdenes y autorizaciones del centro; establecer un límite y un plan de reducción con seguimiento mensual.",
      expected_impact: expectedImpact,
      profitability_impact: profitabilityImpact,
      responsible_id: Number(responsible.id),
      responsible_name: responsible.full_name,
      responsible_position: responsible.position,
      priority,
      due_date: addDays(priority === "ALTA" ? 30 : priority === "MEDIA" ? 60 : 90),
      status: "PROPUESTA",
      source_reference: row.source_reference,
    };
  });
}
