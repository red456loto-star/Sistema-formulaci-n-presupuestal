import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { buildPhase11Analysis } from "./analysis";
import { ensurePhase11Context, type Phase11ContextInput } from "./context";

export type ProposalPriority = "ALTA" | "MEDIA" | "BAJA";
export type ProposalStatus = "PROPUESTA" | "APROBADA" | "EN_EJECUCION" | "IMPLEMENTADA" | "DESCARTADA";

export interface Phase11ProposalInput extends Phase11ContextInput {
  center_id?: number | null;
  element_id?: number | null;
  account_id?: number | null;
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

function ensureRelated(database: DatabaseManager, input: Phase11ProposalInput) {
  ensurePhase11Context(database, input);
  const responsible = database.connection.prepare("SELECT * FROM responsibles WHERE id=? AND company_id=? AND active=1")
    .get(input.responsible_id, input.company_id);
  if (!responsible) httpError("El responsable no pertenece a la empresa o está inactivo.", 400);
  if (input.center_id) {
    const center = database.connection.prepare("SELECT id,responsible_id FROM activity_centers WHERE id=? AND company_id=? AND active=1")
      .get(input.center_id, input.company_id) as { id: number; responsible_id: number } | undefined;
    if (!center) httpError("El centro no pertenece a la empresa.", 400);
  }
  if (!Number.isFinite(input.evidence_value)) httpError("La propuesta requiere evidencia cuantitativa válida.", 400);
  if (!input.evidence_text.trim()) httpError("Explique el origen de la evidencia cuantitativa.", 400);
  if (!input.problem.trim() || !input.proposed_action.trim()) httpError("Registre el problema y la acción propuesta.", 400);
}

function detail(database: DatabaseManager, id: number) {
  const row = database.connection.prepare(`SELECT p.*,bt.code budget_type_code,bt.name budget_type_name,
      c.code center_code,c.name center_name,e.code element_code,e.name element_name,a.code account_code,a.name account_name,
      r.full_name responsible_name,r.position responsible_position
    FROM phase11_improvement_proposals p JOIN budget_types bt ON bt.id=p.budget_type_id
    LEFT JOIN activity_centers c ON c.id=p.center_id LEFT JOIN budget_elements e ON e.id=p.element_id
    LEFT JOIN budget_accounts a ON a.id=p.account_id JOIN responsibles r ON r.id=p.responsible_id WHERE p.id=?`).get(id);
  if (!row) httpError("La propuesta no existe.", 404);
  return row;
}

export function listPhase11Proposals(database: DatabaseManager, input: Phase11ContextInput) {
  ensurePhase11Context(database, input);
  return database.connection.prepare(`SELECT p.*,bt.code budget_type_code,bt.name budget_type_name,
      c.code center_code,c.name center_name,e.code element_code,e.name element_name,a.code account_code,a.name account_name,
      r.full_name responsible_name,r.position responsible_position
    FROM phase11_improvement_proposals p JOIN budget_types bt ON bt.id=p.budget_type_id
    LEFT JOIN activity_centers c ON c.id=p.center_id LEFT JOIN budget_elements e ON e.id=p.element_id
    LEFT JOIN budget_accounts a ON a.id=p.account_id JOIN responsibles r ON r.id=p.responsible_id
    WHERE p.company_id=? AND p.exercise_id=? AND p.period_id=? AND p.version_id=? AND p.budget_type_id=?
    ORDER BY CASE p.priority WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,p.due_date,p.id DESC`)
    .all(input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id);
}

export function createPhase11Proposal(database: DatabaseManager, input: Phase11ProposalInput) {
  ensureRelated(database, input);
  const stamp = new Date().toISOString();
  const id = Number(database.connection.prepare(`INSERT INTO phase11_improvement_proposals
    (company_id,exercise_id,period_id,version_id,budget_type_id,center_id,element_id,account_id,problem,evidence_value,evidence_unit,
     evidence_text,probable_cause,proposed_action,expected_impact,profitability_impact,responsible_id,priority,due_date,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      input.company_id,input.exercise_id,input.period_id,input.version_id,input.budget_type_id,input.center_id ?? null,input.element_id ?? null,input.account_id ?? null,
      input.problem.trim(),input.evidence_value,input.evidence_unit.trim(),input.evidence_text.trim(),input.probable_cause.trim(),input.proposed_action.trim(),
      input.expected_impact,input.profitability_impact ?? null,input.responsible_id,input.priority,input.due_date,input.status ?? "PROPUESTA",stamp,stamp,
    ).lastInsertRowid);
  return detail(database, id);
}

export function updatePhase11Proposal(database: DatabaseManager, id: number, patch: Partial<Pick<Phase11ProposalInput,
  "problem" | "evidence_value" | "evidence_unit" | "evidence_text" | "probable_cause" | "proposed_action" | "expected_impact" |
  "profitability_impact" | "responsible_id" | "priority" | "due_date" | "status">>) {
  const before = detail(database, id) as Record<string, unknown>;
  const merged: Phase11ProposalInput = {
    company_id: Number(before.company_id), exercise_id: Number(before.exercise_id), period_id: Number(before.period_id),
    version_id: Number(before.version_id), budget_type_id: Number(before.budget_type_id), center_id: before.center_id ? Number(before.center_id) : null,
    element_id: before.element_id ? Number(before.element_id) : null, account_id: before.account_id ? Number(before.account_id) : null,
    problem: String(patch.problem ?? before.problem), evidence_value: Number(patch.evidence_value ?? before.evidence_value),
    evidence_unit: String(patch.evidence_unit ?? before.evidence_unit), evidence_text: String(patch.evidence_text ?? before.evidence_text),
    probable_cause: String(patch.probable_cause ?? before.probable_cause), proposed_action: String(patch.proposed_action ?? before.proposed_action),
    expected_impact: Number(patch.expected_impact ?? before.expected_impact),
    profitability_impact: patch.profitability_impact === undefined ? (before.profitability_impact === null ? null : Number(before.profitability_impact)) : patch.profitability_impact,
    responsible_id: Number(patch.responsible_id ?? before.responsible_id), priority: String(patch.priority ?? before.priority) as ProposalPriority,
    due_date: String(patch.due_date ?? before.due_date), status: String(patch.status ?? before.status) as ProposalStatus,
  };
  ensureRelated(database, merged);
  database.connection.prepare(`UPDATE phase11_improvement_proposals SET problem=?,evidence_value=?,evidence_unit=?,evidence_text=?,probable_cause=?,
    proposed_action=?,expected_impact=?,profitability_impact=?,responsible_id=?,priority=?,due_date=?,status=?,updated_at=? WHERE id=?`).run(
      merged.problem.trim(),merged.evidence_value,merged.evidence_unit.trim(),merged.evidence_text.trim(),merged.probable_cause.trim(),merged.proposed_action.trim(),
      merged.expected_impact,merged.profitability_impact ?? null,merged.responsible_id,merged.priority,merged.due_date,merged.status,new Date().toISOString(),id,
    );
  return detail(database, id);
}

function dueDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function suggestPhase11Proposals(database: DatabaseManager, input: Phase11ContextInput) {
  ensurePhase11Context(database, input);
  const analysis = buildPhase11Analysis(database, input);
  const sales = Number(analysis.financial.real.sales || analysis.financial.budgeted.sales || 0);
  return analysis.variations.rows.filter((row) => row.status === "DESFAVORABLE" && Number(row.variation) !== 0).slice(0, 10).map((row) => {
    const amount = Math.abs(Number(row.variation));
    const impact = amount * 0.5;
    const participation = Math.abs(Number(row.variation_percentage ?? 0));
    const priority: ProposalPriority = participation >= 20 ? "ALTA" : participation >= 8 ? "MEDIA" : "BAJA";
    const center = row.center_id ? database.connection.prepare(`SELECT c.id,c.responsible_id,r.full_name responsible_name,r.position responsible_position
      FROM activity_centers c JOIN responsibles r ON r.id=c.responsible_id WHERE c.id=? AND c.company_id=?`).get(row.center_id, input.company_id) as Record<string, unknown> | undefined : undefined;
    const fallback = database.connection.prepare("SELECT id,full_name responsible_name,position responsible_position FROM responsibles WHERE company_id=? AND active=1 ORDER BY id LIMIT 1")
      .get(input.company_id) as Record<string, unknown> | undefined;
    const responsible = center ?? fallback;
    if (!responsible) httpError("Registre un responsable empresarial antes de generar propuestas.", 409);
    const isIncome = row.account_nature === "INGRESO";
    return {
      ...input,
      center_id: row.center_id,
      center_label: `${row.center_code ?? "—"} · ${row.center_name ?? "Sin centro"}`,
      element_id: row.element_id,
      element_label: `${row.element_code ?? "—"} · ${row.element_name ?? "Sin elemento"}`,
      account_id: row.account_id,
      account_label: `${row.account_code ?? "—"} · ${row.account_name}`,
      problem: isIncome ? `Ingreso real inferior al presupuesto en ${row.account_name}` : `Sobreejecución desfavorable en ${row.account_name}`,
      evidence_value: amount,
      evidence_unit: "MONEDA",
      evidence_text: `Presupuestado: ${Number(row.budgeted).toFixed(2)}; real: ${Number(row.real).toFixed(2)}; variación: ${Number(row.variation).toFixed(2)} (${Number(row.variation_percentage ?? 0).toFixed(2)} %).`,
      probable_cause: isIncome ? "Menor volumen, precio o cumplimiento comercial respecto del presupuesto. Debe confirmarse con el responsable del centro." : "Mayor consumo, precio unitario o gasto no previsto. Debe confirmarse con el responsable del centro.",
      proposed_action: isIncome ? "Revisar cartera, volumen, precio y plan comercial; acordar medidas de recuperación y actualizar el forecast." : "Revisar consumos, precios y autorizaciones; definir meta de reducción y seguimiento por periodo.",
      expected_impact: Math.round(impact * 100) / 100,
      profitability_impact: sales === 0 ? null : Math.round((impact / Math.abs(sales)) * 10000) / 100,
      responsible_id: Number(responsible.id ?? responsible.responsible_id),
      responsible_name: responsible.responsible_name,
      responsible_position: responsible.responsible_position,
      priority,
      due_date: dueDate(priority === "ALTA" ? 30 : priority === "MEDIA" ? 60 : 90),
      status: "PROPUESTA" as ProposalStatus,
    };
  });
}
