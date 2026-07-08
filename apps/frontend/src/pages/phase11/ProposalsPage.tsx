import { useEffect, useMemo, useState } from "react";
import { Download, Lightbulb, PlusCircle, Printer, Save } from "lucide-react";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import { downloadPhase10, formatReportValue } from "../phase10/utils";
import type { Phase11Proposal } from "./types";

type Responsible = { id: number; full_name: string; position: string; active: number };
type Suggestion = Omit<Phase11Proposal, "id"> & { center_label: string; element_label: string; account_label: string };

function contextBody(values: { companyId: number; exerciseId: number; periodId: number; versionId: number; budgetTypeId: number }) {
  return { company_id: values.companyId, exercise_id: values.exerciseId, period_id: values.periodId, version_id: values.versionId, budget_type_id: values.budgetTypeId };
}
function contextQuery(values: { companyId: number; exerciseId: number; periodId: number; versionId: number; budgetTypeId: number }) {
  return new URLSearchParams(Object.entries(contextBody(values)).map(([key, value]) => [key, String(value)])).toString();
}
function blankForm() {
  const due = new Date(); due.setDate(due.getDate() + 60);
  return { center_id: "", element_id: "", account_id: "", problem: "", evidence_value: "", evidence_unit: "MONEDA", evidence_text: "", probable_cause: "", proposed_action: "", expected_impact: "", profitability_impact: "", responsible_id: "", priority: "MEDIA", due_date: due.toISOString().slice(0, 10), status: "PROPUESTA" };
}

export function Phase11ProposalsPage() {
  const { companyId, exerciseId, periodId, versionId, budgetTypeId, workflowStatus, company, period, version, budgetType } = useWorkspace();
  const [tab, setTab] = useState("Propuestas registradas");
  const [proposals, setProposals] = useState<Phase11Proposal[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [form, setForm] = useState(blankForm());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready = Boolean(companyId && exerciseId && periodId && versionId && budgetTypeId && workflowStatus?.master_data_ready);
  const context = useMemo(() => ready ? { companyId: companyId!, exerciseId: exerciseId!, periodId: periodId!, versionId: versionId!, budgetTypeId: budgetTypeId! } : null, [ready, companyId, exerciseId, periodId, versionId, budgetTypeId]);

  const load = async () => {
    if (!context) { setProposals([]); return; }
    try {
      const [rows, people] = await Promise.all([
        apiRequest<Phase11Proposal[]>(`/api/phase11/proposals?${contextQuery(context)}`),
        apiRequest<Responsible[]>(`/api/catalog/responsables?company_id=${context.companyId}`),
      ]);
      setProposals(rows); setResponsibles(people.filter((item) => item.active));
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible cargar las propuestas."); }
  };
  useEffect(() => { void load(); }, [companyId, exerciseId, periodId, versionId, budgetTypeId, workflowStatus?.master_data_ready]);

  const suggest = async () => {
    if (!context) return;
    setBusy(true); setMessage("");
    try {
      const rows = await apiRequest<Suggestion[]>("/api/phase11/proposals/suggestions", { method: "POST", body: JSON.stringify(contextBody(context)) });
      setSuggestions(rows); setTab("Sugerencias con evidencia");
      setMessage(rows.length ? `Se generaron ${rows.length} sugerencias sustentadas en variaciones desfavorables.` : "No existen desviaciones desfavorables que justifiquen una propuesta automática.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible generar sugerencias."); }
    finally { setBusy(false); }
  };

  const useSuggestion = (row: Suggestion) => {
    setForm({
      center_id: row.center_id ? String(row.center_id) : "", element_id: row.element_id ? String(row.element_id) : "", account_id: row.account_id ? String(row.account_id) : "",
      problem: row.problem, evidence_value: String(row.evidence_value), evidence_unit: row.evidence_unit, evidence_text: row.evidence_text,
      probable_cause: row.probable_cause, proposed_action: row.proposed_action, expected_impact: String(row.expected_impact),
      profitability_impact: row.profitability_impact === null ? "" : String(row.profitability_impact), responsible_id: String(row.responsible_id),
      priority: row.priority, due_date: row.due_date, status: "PROPUESTA",
    }); setTab("Registrar propuesta");
  };

  const save = async () => {
    if (!context) return;
    setBusy(true); setMessage("");
    try {
      await apiRequest("/api/phase11/proposals", { method: "POST", body: JSON.stringify({
        ...contextBody(context), center_id: form.center_id ? Number(form.center_id) : null, element_id: form.element_id ? Number(form.element_id) : null,
        account_id: form.account_id ? Number(form.account_id) : null, problem: form.problem, evidence_value: Number(form.evidence_value), evidence_unit: form.evidence_unit,
        evidence_text: form.evidence_text, probable_cause: form.probable_cause, proposed_action: form.proposed_action, expected_impact: Number(form.expected_impact),
        profitability_impact: form.profitability_impact === "" ? null : Number(form.profitability_impact), responsible_id: Number(form.responsible_id),
        priority: form.priority, due_date: form.due_date, status: form.status,
      }) });
      setForm(blankForm()); setMessage("Propuesta registrada correctamente."); await load(); setTab("Propuestas registradas");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible registrar la propuesta."); }
    finally { setBusy(false); }
  };

  const changeStatus = async (row: Phase11Proposal, status: string) => {
    setBusy(true); setMessage("");
    try { await apiRequest(`/api/phase11/proposals/${row.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); setMessage("Estado actualizado correctamente."); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible actualizar el estado."); }
    finally { setBusy(false); }
  };

  const report = async (format: "excel" | "pdf") => {
    if (!context) return;
    setBusy(true); setMessage("");
    try { await downloadPhase10(`/api/phase11/reports/${format}`, { ...contextBody(context), kind: "PROPOSALS" }, `propuestas.${format === "excel" ? "xlsx" : "pdf"}`); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible generar el informe."); }
    finally { setBusy(false); }
  };

  return <div className="page-stack phase11-page">
    <section className="page-heading phase11-no-print"><div><span className="eyebrow">Paso 7 · Impacto positivo en rentabilidad</span><h1>Informe de propuestas de mejora</h1><p>Registra acciones para el presupuesto original o forecast con evidencia cuantitativa, responsable, plazo e impacto esperado.</p></div><div className="button-row"><button className="button button--ghost" disabled={!proposals.length} onClick={() => window.print()}><Printer size={16} />Imprimir</button><button className="button button--ghost" disabled={busy || !ready} onClick={() => void report("excel")}><Download size={16} />Excel</button><button className="button button--primary" disabled={busy || !ready} onClick={() => void report("pdf")}><Download size={16} />PDF</button></div></section>
    {!ready && <Message type="danger">Esta opción se habilita cuando existe información en Tablas maestras para el contexto activo.</Message>}
    {message && <Message type={/correctamente|generaron|No existen/.test(message) ? "success" : "danger"}>{message}</Message>}
    {ready && <section className="panel phase11-context-summary"><div><strong>{company?.commercial_name}</strong><span>{period?.name} · {version?.code} · {budgetType?.name}</span></div><button className="button button--primary phase11-no-print" disabled={busy} onClick={() => void suggest()}><Lightbulb size={16} />Analizar y sugerir</button></section>}
    <Tabs items={["Propuestas registradas", "Sugerencias con evidencia", "Registrar propuesta"]} active={tab} onChange={setTab} />

    {tab === "Propuestas registradas" && <section className="panel phase11-print-area"><div className="panel__heading"><div><span className="eyebrow">Seguimiento</span><h2>Propuestas del contexto activo</h2></div></div><DataTable headers={["Prioridad", "Estado", "Problema", "Evidencia", "Dimensión", "Acción", "Impacto", "Rentabilidad", "Responsable", "Plazo", "Actualizar"]} rows={proposals.map((row) => [<span key="priority" className={`phase11-priority phase11-priority--${row.priority.toLowerCase()}`}>{row.priority}</span>, row.status.replaceAll("_", " "), row.problem, row.evidence_text, `${row.center_code ?? "—"} ${row.center_name ?? ""}\n${row.element_code ?? "—"} ${row.element_name ?? ""}\n${row.account_code ?? "—"} ${row.account_name ?? ""}`, row.proposed_action, formatReportValue(row.expected_impact, "money", "PEN"), formatReportValue(row.profitability_impact, "percent"), `${row.responsible_name} · ${row.responsible_position}`, formatReportValue(row.due_date, "date"), <select key="status" disabled={busy} value={row.status} onChange={(event) => void changeStatus(row, event.target.value)}>{["PROPUESTA","APROBADA","EN_EJECUCION","IMPLEMENTADA","DESCARTADA"].map((value) => <option key={value}>{value}</option>)}</select>])} empty="No existen propuestas registradas." /></section>}

    {tab === "Sugerencias con evidencia" && <section className="phase11-suggestions">{suggestions.map((row, index) => <article className="panel phase11-suggestion" key={`${row.account_id}-${row.center_id}-${index}`}><div className="phase11-suggestion__top"><span className={`phase11-priority phase11-priority--${row.priority.toLowerCase()}`}>{row.priority}</span><span>{row.account_label}</span></div><h3>{row.problem}</h3><p><strong>Evidencia:</strong> {row.evidence_text}</p><dl><div><dt>Centro</dt><dd>{row.center_label}</dd></div><div><dt>Elemento</dt><dd>{row.element_label}</dd></div><div><dt>Impacto esperado</dt><dd>{formatReportValue(row.expected_impact, "money", "PEN")}</dd></div><div><dt>Rentabilidad</dt><dd>{formatReportValue(row.profitability_impact, "percent")}</dd></div><div><dt>Responsable</dt><dd>{row.responsible_name}</dd></div></dl><button className="button button--primary" onClick={() => useSuggestion(row)}><PlusCircle size={16} />Revisar y registrar</button></article>)}{!suggestions.length && <Message>Pulse “Analizar y sugerir” para generar propuestas basadas en evidencia.</Message>}</section>}

    {tab === "Registrar propuesta" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Registro sustentado</span><h2>Problema, evidencia, acción e impacto</h2></div><Save /></div><FormGrid>
      <Field label="Problema" span={2}><textarea rows={2} value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} /></Field>
      <Field label="Evidencia cuantitativa"><input type="number" step="0.01" value={form.evidence_value} onChange={(event) => setForm({ ...form, evidence_value: event.target.value })} /></Field>
      <Field label="Unidad"><input value={form.evidence_unit} onChange={(event) => setForm({ ...form, evidence_unit: event.target.value })} /></Field>
      <Field label="Explicación de la evidencia" span={2}><textarea rows={3} value={form.evidence_text} onChange={(event) => setForm({ ...form, evidence_text: event.target.value })} /></Field>
      <Field label="Causa probable" span={2}><textarea rows={3} value={form.probable_cause} onChange={(event) => setForm({ ...form, probable_cause: event.target.value })} /></Field>
      <Field label="Acción propuesta" span={2}><textarea rows={3} value={form.proposed_action} onChange={(event) => setForm({ ...form, proposed_action: event.target.value })} /></Field>
      <Field label="Impacto esperado"><input type="number" step="0.01" value={form.expected_impact} onChange={(event) => setForm({ ...form, expected_impact: event.target.value })} /></Field>
      <Field label="Impacto en rentabilidad (%)"><input type="number" step="0.01" value={form.profitability_impact} onChange={(event) => setForm({ ...form, profitability_impact: event.target.value })} /></Field>
      <Field label="Responsable"><select value={form.responsible_id} onChange={(event) => setForm({ ...form, responsible_id: event.target.value })}><option value="">Seleccione</option>{responsibles.map((row) => <option key={row.id} value={row.id}>{row.full_name} · {row.position}</option>)}</select></Field>
      <Field label="Prioridad"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{["ALTA","MEDIA","BAJA"].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Plazo"><input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></Field>
      <Field label="Estado"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["PROPUESTA","APROBADA","EN_EJECUCION","IMPLEMENTADA","DESCARTADA"].map((value) => <option key={value}>{value}</option>)}</select></Field>
    </FormGrid><Message>No se guarda ninguna propuesta sin evidencia numérica y sustento.</Message><button className="button button--primary" disabled={busy || !ready || !form.problem || !form.evidence_text || !form.proposed_action || !form.responsible_id} onClick={() => void save()}><Save size={16} />Registrar propuesta</button></section>}
  </div>;
}
