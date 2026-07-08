import { useEffect, useMemo, useState } from "react";
import { Download, Lightbulb, PlusCircle, RefreshCw, Save, Target } from "lucide-react";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import type { Phase10Options, Proposal, ProposalPriority, ProposalStatus, ProposalSuggestion } from "./types";
import { downloadPhase10, formatReportValue } from "./utils";

type ElementOption = { id: number; group_id: number; code: string; name: string; active: number };
type AccountOption = { id: number; element_id: number; code: string; name: string; nature: string; active: number };

const EMPTY_OPTIONS: Phase10Options = { versions: [], approved_versions: [], centers: [], responsibles: [] };
const statuses: ProposalStatus[] = ["PROPUESTA", "APROBADA", "EN_EJECUCION", "IMPLEMENTADA", "DESCARTADA"];
const priorities: ProposalPriority[] = ["ALTA", "MEDIA", "BAJA"];

function blankForm() {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return {
    center_id: "", element_id: "", account_id: "", source_type: "VARIACION",
    problem: "", evidence_value: "", evidence_unit: "PEN", evidence_text: "",
    probable_cause: "", proposed_action: "", expected_impact: "", profitability_impact: "",
    responsible_id: "", priority: "MEDIA" as ProposalPriority, due_date: date.toISOString().slice(0, 10), status: "PROPUESTA" as ProposalStatus,
    period_id: "",
  };
}

export function ProposalsPage() {
  const { companyId, exerciseId, versionId, period } = useWorkspace();
  const [tab, setTab] = useState("Propuestas registradas");
  const [options, setOptions] = useState<Phase10Options>(EMPTY_OPTIONS);
  const [elements, setElements] = useState<ElementOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [suggestions, setSuggestions] = useState<ProposalSuggestion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
  const [form, setForm] = useState(blankForm());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    if (!companyId || !exerciseId) {
      setOptions(EMPTY_OPTIONS); setElements([]); setAccounts([]); setProposals([]); setSelectedVersion(""); return;
    }
    setBusy(true); setError("");
    try {
      const [nextOptions, nextElements, nextAccounts] = await Promise.all([
        apiRequest<Phase10Options>(`/api/phase10/options?company_id=${companyId}&exercise_id=${exerciseId}`),
        apiRequest<ElementOption[]>(`/api/catalog/elementos?company_id=${companyId}`),
        apiRequest<AccountOption[]>(`/api/catalog/cuentas?company_id=${companyId}`),
      ]);
      setOptions(nextOptions);
      setElements(nextElements.filter((item) => item.active));
      setAccounts(nextAccounts.filter((item) => item.active));
      const preferred = nextOptions.versions.find((item) => item.id === versionId) ?? nextOptions.versions[0];
      const nextVersion = selectedVersion && nextOptions.versions.some((item) => item.id === Number(selectedVersion)) ? selectedVersion : preferred ? String(preferred.id) : "";
      setSelectedVersion(nextVersion);
      if (nextVersion) setProposals(await apiRequest<Proposal[]>(`/api/phase10/proposals?company_id=${companyId}&exercise_id=${exerciseId}&version_id=${nextVersion}`));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible cargar las propuestas."); }
    finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, [companyId, exerciseId, versionId]);
  useEffect(() => {
    if (!companyId || !exerciseId || !selectedVersion) { setProposals([]); return; }
    apiRequest<Proposal[]>(`/api/phase10/proposals?company_id=${companyId}&exercise_id=${exerciseId}&version_id=${selectedVersion}`)
      .then(setProposals).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible actualizar las propuestas."));
    setSuggestions([]);
  }, [selectedVersion]);

  const filteredAccounts = useMemo(() => accounts.filter((item) => !form.element_id || item.element_id === Number(form.element_id)), [accounts, form.element_id]);
  const selectedCenter = useMemo(() => options.centers.find((item) => item.id === Number(form.center_id)), [options.centers, form.center_id]);
  useEffect(() => {
    if (selectedCenter) setForm((current) => ({ ...current, responsible_id: String(selectedCenter.responsible_id) }));
  }, [selectedCenter?.id]);

  const generateSuggestions = async () => {
    if (!companyId || !exerciseId || !selectedVersion) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiRequest<ProposalSuggestion[]>("/api/phase10/proposals/suggestions", {
        method: "POST",
        body: JSON.stringify({ company_id: companyId, exercise_id: exerciseId, version_id: Number(selectedVersion), period_number: period?.period_number ?? null, center_id: centerFilter ? Number(centerFilter) : null }),
      });
      setSuggestions(result);
      setMessage(result.length ? `Se identificaron ${result.length} oportunidades sustentadas en variaciones desfavorables.` : "No se encontraron desviaciones desfavorables con evidencia suficiente para proponer acciones.");
      setTab("Sugerencias con evidencia");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible analizar oportunidades de mejora."); }
    finally { setBusy(false); }
  };

  const useSuggestion = (suggestion: ProposalSuggestion) => {
    setForm({
      center_id: String(suggestion.center_id ?? ""), element_id: String(suggestion.element_id ?? ""), account_id: String(suggestion.account_id ?? ""),
      source_type: suggestion.source_type, problem: suggestion.problem, evidence_value: String(suggestion.evidence_value), evidence_unit: suggestion.evidence_unit,
      evidence_text: suggestion.evidence_text, probable_cause: suggestion.probable_cause, proposed_action: suggestion.proposed_action,
      expected_impact: String(suggestion.expected_impact), profitability_impact: suggestion.profitability_impact === null ? "" : String(suggestion.profitability_impact),
      responsible_id: String(suggestion.responsible_id), priority: suggestion.priority, due_date: suggestion.due_date, status: "PROPUESTA",
      period_id: String(suggestion.period_id ?? ""),
    });
    setTab("Registrar propuesta");
  };

  const saveProposal = async () => {
    if (!companyId || !exerciseId || !selectedVersion) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest<Proposal>("/api/phase10/proposals", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId, exercise_id: exerciseId, version_id: Number(selectedVersion), period_id: form.period_id ? Number(form.period_id) : null,
          center_id: form.center_id ? Number(form.center_id) : null, element_id: form.element_id ? Number(form.element_id) : null,
          account_id: form.account_id ? Number(form.account_id) : null, source_type: form.source_type,
          problem: form.problem, evidence_value: Number(form.evidence_value), evidence_unit: form.evidence_unit, evidence_text: form.evidence_text,
          probable_cause: form.probable_cause, proposed_action: form.proposed_action, expected_impact: Number(form.expected_impact),
          profitability_impact: form.profitability_impact === "" ? null : Number(form.profitability_impact), responsible_id: Number(form.responsible_id),
          priority: form.priority, due_date: form.due_date, status: form.status,
        }),
      });
      setMessage("Propuesta registrada con su evidencia, responsable, plazo e impacto esperado.");
      setForm(blankForm());
      setProposals(await apiRequest<Proposal[]>(`/api/phase10/proposals?company_id=${companyId}&exercise_id=${exerciseId}&version_id=${selectedVersion}`));
      setTab("Propuestas registradas");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible registrar la propuesta."); }
    finally { setBusy(false); }
  };

  const changeStatus = async (proposal: Proposal, status: ProposalStatus) => {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest(`/api/phase10/proposals/${proposal.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage(`La propuesta quedó en estado ${status.replaceAll("_", " ").toLowerCase()}.`);
      if (companyId && exerciseId) setProposals(await apiRequest<Proposal[]>(`/api/phase10/proposals?company_id=${companyId}&exercise_id=${exerciseId}&version_id=${selectedVersion}`));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible actualizar el estado."); }
    finally { setBusy(false); }
  };

  const exportProposals = async (format: "excel" | "pdf") => {
    if (!companyId || !exerciseId || !selectedVersion) return;
    setBusy(true); setError("");
    try {
      await downloadPhase10(`/api/phase10/reports/${format}`, {
        company_id: companyId, exercise_id: exerciseId, version_id: Number(selectedVersion), report_type: "PROPOSALS",
        period_number: period?.period_number ?? null, center_id: centerFilter ? Number(centerFilter) : null, responsible_id: null,
      }, `propuestas.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible exportar las propuestas."); }
    finally { setBusy(false); }
  };

  return <div className="page-stack phase10-page">
    <section className="page-heading">
      <div><span className="eyebrow">Fase 10 · Mejora de rentabilidad</span><h1>Propuestas de mejora</h1><p>Convierte variaciones, centros críticos y estructura de costos en acciones con evidencia cuantitativa y responsable empresarial.</p></div>
      <div className="button-row"><button className="button button--ghost" disabled={busy || !selectedVersion} onClick={() => void exportProposals("excel")}><Download size={16} />Excel</button><button className="button button--primary" disabled={busy || !selectedVersion} onClick={() => void exportProposals("pdf")}><Download size={16} />PDF</button></div>
    </section>
    {error && <Message type="danger">{error}</Message>}
    {message && <Message type="success">{message}</Message>}
    {!companyId || !exerciseId ? <Message>Seleccione una empresa y un ejercicio en la barra superior.</Message> : <>
      <section className="panel phase10-no-print">
        <div className="panel__heading"><div><span className="eyebrow">Base de análisis</span><h2>Versión y alcance</h2></div><Target size={22} /></div>
        <FormGrid>
          <Field label="Versión"><select value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)}><option value="">Seleccione</option>{options.versions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.version_type} · {item.status}</option>)}</select></Field>
          <Field label="Centro para sugerencias"><select value={centerFilter} onChange={(event) => setCenterFilter(event.target.value)}><option value="">Todos los centros</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        </FormGrid>
        <div className="phase10-actions"><span className="muted">El sistema solo sugiere acciones cuando encuentra una desviación desfavorable cuantificable.</span><button className="button button--primary" disabled={busy || !selectedVersion} onClick={() => void generateSuggestions()}><Lightbulb size={16} />Analizar y sugerir</button></div>
      </section>

      <Tabs items={["Propuestas registradas", "Sugerencias con evidencia", "Registrar propuesta"]} active={tab} onChange={setTab} />

      {tab === "Propuestas registradas" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Seguimiento</span><h2>Historial de propuestas</h2></div><RefreshCw size={22} /></div><DataTable headers={["Prioridad", "Estado", "Problema", "Evidencia", "Centro / cuenta", "Acción", "Impacto", "Rentabilidad", "Responsable", "Plazo", "Actualizar"]} rows={proposals.map((row) => [
        <span key="priority" className={`phase10-priority phase10-priority--${row.priority.toLowerCase()}`}>{row.priority}</span>, row.status.replaceAll("_", " "), row.problem,
        `${formatReportValue(row.evidence_value, "number")} ${row.evidence_unit} · ${row.evidence_text}`,
        `${row.center_code ?? "—"} ${row.center_name ?? ""}\n${row.account_code ?? "—"} ${row.account_name ?? ""}`, row.proposed_action,
        formatReportValue(row.expected_impact, "money", row.evidence_unit === "%" ? "PEN" : row.evidence_unit), formatReportValue(row.profitability_impact, "percent"),
        `${row.responsible_name} · ${row.responsible_position}`, formatReportValue(row.due_date, "date"),
        <select key="status" value={row.status} disabled={busy} onChange={(event) => void changeStatus(row, event.target.value as ProposalStatus)}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>,
      ])} empty="Todavía no existen propuestas registradas para esta versión." /></section>}

      {tab === "Sugerencias con evidencia" && <section className="phase10-suggestions">{suggestions.map((item) => <article className="panel phase10-suggestion" key={`${item.period_id}-${item.center_id}-${item.account_id}`}><div className="phase10-suggestion__top"><span className={`phase10-priority phase10-priority--${item.priority.toLowerCase()}`}>{item.priority}</span><span>{item.source_type}</span></div><h3>{item.problem}</h3><p><strong>Evidencia:</strong> {item.evidence_text}</p><dl><div><dt>Centro</dt><dd>{item.center_label}</dd></div><div><dt>Cuenta</dt><dd>{item.account_label}</dd></div><div><dt>Impacto recuperable</dt><dd>{formatReportValue(item.expected_impact, "money", item.evidence_unit)}</dd></div><div><dt>Rentabilidad</dt><dd>{formatReportValue(item.profitability_impact, "percent")}</dd></div><div><dt>Responsable</dt><dd>{item.responsible_name}</dd></div><div><dt>Plazo</dt><dd>{formatReportValue(item.due_date, "date")}</dd></div></dl><button className="button button--primary" onClick={() => useSuggestion(item)}><PlusCircle size={16} />Revisar y registrar</button></article>)}{!suggestions.length && <Message>No existen sugerencias generadas. Pulse “Analizar y sugerir”.</Message>}</section>}

      {tab === "Registrar propuesta" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Registro sustentado</span><h2>Problema, evidencia, acción e impacto</h2></div><Save size={22} /></div><FormGrid>
        <Field label="Origen"><select value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value })}>{["ORIGINAL", "FORECAST", "VARIACION", "COSTOS", "DASHBOARD"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Centro"><select value={form.center_id} onChange={(event) => setForm({ ...form, center_id: event.target.value })}><option value="">Sin centro específico</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        <Field label="Elemento"><select value={form.element_id} onChange={(event) => setForm({ ...form, element_id: event.target.value, account_id: "" })}><option value="">Sin elemento específico</option>{elements.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        <Field label="Cuenta"><select value={form.account_id} onChange={(event) => setForm({ ...form, account_id: event.target.value })}><option value="">Sin cuenta específica</option>{filteredAccounts.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        <Field label="Problema" span={2}><textarea value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} rows={2} /></Field>
        <Field label="Evidencia cuantitativa"><input type="number" step="0.01" value={form.evidence_value} onChange={(event) => setForm({ ...form, evidence_value: event.target.value })} /></Field>
        <Field label="Unidad"><input value={form.evidence_unit} onChange={(event) => setForm({ ...form, evidence_unit: event.target.value.toUpperCase() })} /></Field>
        <Field label="Sustento de la evidencia" span={2}><textarea value={form.evidence_text} onChange={(event) => setForm({ ...form, evidence_text: event.target.value })} rows={3} /></Field>
        <Field label="Causa probable" span={2}><textarea value={form.probable_cause} onChange={(event) => setForm({ ...form, probable_cause: event.target.value })} rows={3} /></Field>
        <Field label="Acción propuesta" span={2}><textarea value={form.proposed_action} onChange={(event) => setForm({ ...form, proposed_action: event.target.value })} rows={3} /></Field>
        <Field label="Impacto esperado"><input type="number" step="0.01" value={form.expected_impact} onChange={(event) => setForm({ ...form, expected_impact: event.target.value })} /></Field>
        <Field label="Impacto en rentabilidad (%)"><input type="number" step="0.01" value={form.profitability_impact} onChange={(event) => setForm({ ...form, profitability_impact: event.target.value })} /></Field>
        <Field label="Responsable"><select value={form.responsible_id} onChange={(event) => setForm({ ...form, responsible_id: event.target.value })}><option value="">Seleccione</option>{options.responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field>
        <Field label="Prioridad"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as ProposalPriority })}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Plazo"><input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></Field>
        <Field label="Estado"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProposalStatus })}>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
      </FormGrid><Message>No se puede guardar una propuesta sin evidencia numérica y explicación de su origen.</Message><button className="button button--primary" disabled={busy || !form.problem || !form.evidence_text || !form.proposed_action || !form.responsible_id} onClick={() => void saveProposal()}><Save size={16} />Registrar propuesta</button></section>}
    </>}
  </div>;
}
