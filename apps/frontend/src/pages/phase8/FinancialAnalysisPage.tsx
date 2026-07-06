import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Download, RefreshCw, Save } from "lucide-react";
import { Tabs, Field, FormGrid, Message } from "../../components/phase2/Ui";
import { API_BASE_URL, apiRequest } from "../../lib/api";
import { useWorkspace, type BudgetExercise, type BudgetVersion } from "../../context/WorkspaceContext";
import { DupontEvaView, HorizontalView, RatiosView, StatementsView, VerticalView } from "./AnalysisViews";
import type {
  AnalysisAssumptions,
  AnalysisDescriptor,
  AnalysisSourceType,
  FinancialSnapshot,
  HorizontalResult,
  MappingRow,
} from "./types";
import "../../phase8-financial-analysis.css";

const tabs = ["Estados financieros", "Análisis vertical", "Análisis horizontal", "Ratios", "Dupont y EVA", "Configuración"] as const;
type TabName = typeof tabs[number];

type MappingDraft = { statement_section: string; ratio_role: string; notes: string };
interface CompareSide { exercise_id: string; version_id: string; source_type: AnalysisSourceType; period_number: string; }

const EMPTY_MAPPING: MappingDraft = { statement_section: "", ratio_role: "", notes: "" };
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const sectionOptions = [
  ["", "Sin clasificar"], ["SALES", "Ventas"], ["COST_OF_SALES", "Costo de ventas"],
  ["OPERATING_EXPENSE", "Gasto operativo"], ["INCOME_TAX", "Impuesto a la renta"],
  ["CURRENT_ASSET", "Activo corriente"], ["NONCURRENT_ASSET", "Activo no corriente"],
  ["CURRENT_LIABILITY", "Pasivo corriente"], ["NONCURRENT_LIABILITY", "Pasivo no corriente"],
  ["EQUITY", "Patrimonio"], ["IGNORE", "Excluir del análisis"],
] as const;
const roleOptions = [
  ["", "Sin rol específico"], ["CASH", "Efectivo"], ["RECEIVABLES", "Cuentas por cobrar"],
  ["INVENTORY", "Inventarios"], ["OTHER", "Otro activo corriente"],
] as const;

function sourceOptions(version?: BudgetVersion | null) {
  if (!version) return [];
  return version.version_type === "FORECAST"
    ? [{ id: "FORECAST" as const, label: "Forecast" }]
    : [{ id: "ORIGINAL" as const, label: "Presupuesto original" }, { id: "REAL" as const, label: "Información real" }];
}

function query(descriptor: AnalysisDescriptor) {
  const params = new URLSearchParams({
    company_id: String(descriptor.company_id),
    exercise_id: String(descriptor.exercise_id),
    version_id: String(descriptor.version_id),
    source_type: descriptor.source_type,
  });
  if (descriptor.period_number !== null) params.set("period_number", String(descriptor.period_number));
  return params.toString();
}

function blankAssumptions(): AnalysisAssumptions {
  return { tax_rate: null, cost_of_capital_rate: null, invested_capital_override: null, source_reference: null, notes: null, saved: false };
}

export function FinancialAnalysisPage() {
  const { companyId, exerciseId, exercise, versionId, version, exercises } = useWorkspace();
  const [tab, setTab] = useState<TabName>("Estados financieros");
  const [sourceType, setSourceType] = useState<AnalysisSourceType>(version?.version_type === "FORECAST" ? "FORECAST" : "ORIGINAL");
  const [periodNumber, setPeriodNumber] = useState("");
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<number, MappingDraft>>({});
  const [assumptions, setAssumptions] = useState<AnalysisAssumptions>(blankAssumptions());
  const [assumptionForm, setAssumptionForm] = useState({ tax_rate: "", cost_of_capital_rate: "", invested_capital_override: "", source_reference: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [horizontal, setHorizontal] = useState<HorizontalResult | null>(null);
  const [initialSide, setInitialSide] = useState<CompareSide>({ exercise_id: "", version_id: "", source_type: "ORIGINAL", period_number: "" });
  const [finalSide, setFinalSide] = useState<CompareSide>({ exercise_id: "", version_id: "", source_type: "ORIGINAL", period_number: "" });
  const [initialVersions, setInitialVersions] = useState<BudgetVersion[]>([]);
  const [finalVersions, setFinalVersions] = useState<BudgetVersion[]>([]);

  useEffect(() => {
    setSourceType(version?.version_type === "FORECAST" ? "FORECAST" : "ORIGINAL");
    setSnapshot(null);
  }, [versionId, version?.version_type]);

  const descriptor = useMemo<AnalysisDescriptor | null>(() => {
    if (!companyId || !exerciseId || !versionId) return null;
    return { company_id: companyId, exercise_id: exerciseId, version_id: versionId, source_type: sourceType, period_number: periodNumber ? Number(periodNumber) : null };
  }, [companyId, exerciseId, versionId, sourceType, periodNumber]);

  const loadMappings = async () => {
    if (!companyId) return;
    const rows = await apiRequest<MappingRow[]>(`/api/financial-analysis/mappings?company_id=${companyId}`);
    setMappings(rows);
    setMappingDrafts(Object.fromEntries(rows.map((row) => [row.account_id, {
      statement_section: row.statement_section ?? "",
      ratio_role: row.ratio_role ?? "",
      notes: row.notes ?? "",
    }])));
  };

  const loadReport = async () => {
    if (!descriptor) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await apiRequest<FinancialSnapshot>(`/api/financial-analysis/report?${query(descriptor)}`);
      setSnapshot(result);
      setAssumptions(result.assumptions);
      setAssumptionForm({
        tax_rate: result.assumptions.tax_rate === null ? "" : String(result.assumptions.tax_rate),
        cost_of_capital_rate: result.assumptions.cost_of_capital_rate === null ? "" : String(result.assumptions.cost_of_capital_rate),
        invested_capital_override: result.assumptions.invested_capital_override === null ? "" : String(result.assumptions.invested_capital_override),
        source_reference: result.assumptions.source_reference ?? "",
        notes: result.assumptions.notes ?? "",
      });
    } catch (reason) {
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "No fue posible calcular el análisis financiero.");
    } finally { setBusy(false); }
  };

  useEffect(() => { void loadMappings().catch(() => setMappings([])); }, [companyId]);
  useEffect(() => { if (descriptor) void loadReport(); }, [descriptor?.company_id, descriptor?.exercise_id, descriptor?.version_id, descriptor?.source_type, descriptor?.period_number]);

  const saveMappings = async () => {
    if (!companyId) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const selected = mappings.flatMap((row) => {
        const draft = mappingDrafts[row.account_id];
        if (!draft?.statement_section) return [];
        return [{ account_id: row.account_id, statement_section: draft.statement_section, ratio_role: draft.ratio_role || null, notes: draft.notes || null }];
      });
      const result = await apiRequest<{ message: string }>("/api/financial-analysis/mappings", {
        method: "PUT",
        body: JSON.stringify({ company_id: companyId, mappings: selected }),
      });
      setSuccess(result.message);
      await loadMappings();
      await loadReport();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar las clasificaciones."); }
    finally { setBusy(false); }
  };

  const saveAssumptions = async () => {
    if (!descriptor) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      if (!assumptionForm.source_reference.trim()) throw new Error("Documente la fuente de los supuestos.");
      const nullableNumber = (value: string) => value.trim() === "" ? null : Number(value);
      const result = await apiRequest<{ message: string }>("/api/financial-analysis/assumptions", {
        method: "PUT",
        body: JSON.stringify({
          ...descriptor,
          tax_rate: nullableNumber(assumptionForm.tax_rate),
          cost_of_capital_rate: nullableNumber(assumptionForm.cost_of_capital_rate),
          invested_capital_override: nullableNumber(assumptionForm.invested_capital_override),
          source_reference: assumptionForm.source_reference,
          notes: assumptionForm.notes || null,
        }),
      });
      setSuccess(result.message);
      await loadReport();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar los supuestos."); }
    finally { setBusy(false); }
  };

  const exportExcel = async () => {
    if (!descriptor || !snapshot) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/financial-analysis/export?${query(descriptor)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "No fue posible exportar el análisis.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `analisis-financiero-${snapshot.context.source_type.toLowerCase()}-${snapshot.context.version_code}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible exportar el análisis."); }
    finally { setBusy(false); }
  };

  const loadSideVersions = async (side: "initial" | "final", selectedExercise: string) => {
    if (!companyId || !selectedExercise) return;
    const rows = await apiRequest<BudgetVersion[]>(`/api/catalog/versiones?company_id=${companyId}&exercise_id=${selectedExercise}`);
    const first = rows[0];
    const update = (current: CompareSide): CompareSide => ({
      ...current,
      exercise_id: selectedExercise,
      version_id: first ? String(first.id) : "",
      source_type: first?.version_type === "FORECAST" ? "FORECAST" : "ORIGINAL",
    });
    if (side === "initial") { setInitialVersions(rows); setInitialSide(update); }
    else { setFinalVersions(rows); setFinalSide(update); }
  };

  useEffect(() => {
    if (!exerciseId) return;
    const value = String(exerciseId);
    void loadSideVersions("initial", value);
    void loadSideVersions("final", value);
  }, [companyId, exerciseId]);

  const compare = async () => {
    if (!companyId) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const makeDescriptor = (side: CompareSide): AnalysisDescriptor => {
        if (!side.exercise_id || !side.version_id) throw new Error("Complete los escenarios inicial y final.");
        return { company_id: companyId, exercise_id: Number(side.exercise_id), version_id: Number(side.version_id), source_type: side.source_type, period_number: side.period_number ? Number(side.period_number) : null };
      };
      setHorizontal(await apiRequest<HorizontalResult>("/api/financial-analysis/horizontal", {
        method: "POST",
        body: JSON.stringify({ initial: makeDescriptor(initialSide), final: makeDescriptor(finalSide) }),
      }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible realizar la comparación."); }
    finally { setBusy(false); }
  };

  const currency = exercise?.currency_code ?? "PEN";
  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 8 · Análisis financiero</span><h1>Estados financieros y evaluación integral</h1><p>Compara presupuesto original, forecast e información real mediante análisis vertical, horizontal, ratios, Dupont y EVA.</p></div><div className="button-row"><button className="button button--ghost" disabled={busy || !descriptor} onClick={() => void loadReport()}><RefreshCw size={16} />Recalcular</button><button className="button button--primary" disabled={busy || !snapshot} onClick={() => void exportExcel()}><Download size={16} />Exportar Excel</button></div></section>
    {error && <Message type="danger">{error}</Message>}{success && <Message type="success">{success}</Message>}
    {!companyId || !exerciseId || !versionId ? <Message>Seleccione empresa, ejercicio y versión en la barra superior.</Message> : <>
      <section className="panel analysis-context"><FormGrid>
        <Field label="Fuente de análisis"><select value={sourceType} onChange={(event) => setSourceType(event.target.value as AnalysisSourceType)}>{sourceOptions(version).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <Field label="Periodo"><select value={periodNumber} onChange={(event) => setPeriodNumber(event.target.value)}><option value="">Total anual / cierre</option>{months.map((name, index) => <option key={name} value={index + 1}>{index + 1} · {name}</option>)}</select></Field>
        <Field label="Versión"><input value={`${version?.code ?? ""} · ${version?.status ?? ""}`} disabled /></Field>
      </FormGrid></section>
      {snapshot && <>
        <div className="analysis-status-line"><strong>{snapshot.context.source_type} · {snapshot.context.version_code}</strong><span>{snapshot.context.period_label}</span><span className={`status-pill ${snapshot.complete ? "status-pill--success" : "status-pill--warning"}`}>{snapshot.complete ? "Análisis completo" : "Requiere revisión"}</span></div>
        {snapshot.warnings.length > 0 && <div className="analysis-warning-list">{snapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
        <Tabs items={[...tabs]} active={tab} onChange={(value) => setTab(value as TabName)} />
        {tab === "Estados financieros" && <StatementsView snapshot={snapshot} currency={currency} />}
        {tab === "Análisis vertical" && <VerticalView snapshot={snapshot} currency={currency} />}
        {tab === "Ratios" && <RatiosView snapshot={snapshot} />}
        {tab === "Dupont y EVA" && <DupontEvaView snapshot={snapshot} currency={currency} />}
        {tab === "Análisis horizontal" && <>
          <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Comparación</span><h2>Escenario inicial y escenario final</h2><p>Puede comparar periodos, versiones y ejercicios de la misma empresa.</p></div></div><div className="horizontal-selectors"><CompareSelector title="Inicial" side={initialSide} setSide={setInitialSide} exercises={exercises} versions={initialVersions} onExercise={(value) => void loadSideVersions("initial", value)} /><CompareSelector title="Final" side={finalSide} setSide={setFinalSide} exercises={exercises} versions={finalVersions} onExercise={(value) => void loadSideVersions("final", value)} /></div><div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void compare()}>Comparar escenarios</button></div></section>
          <HorizontalView result={horizontal} currency={currency} />
        </>}
        {tab === "Configuración" && <ConfigurationPanel
          assumptions={assumptions}
          form={assumptionForm}
          setForm={setAssumptionForm}
          mappings={mappings}
          drafts={mappingDrafts}
          setDrafts={setMappingDrafts}
          busy={busy}
          onSaveAssumptions={() => void saveAssumptions()}
          onSaveMappings={() => void saveMappings()}
        />}
      </>}
    </>}
  </div>;
}

function ConfigurationPanel({ assumptions, form, setForm, mappings, drafts, setDrafts, busy, onSaveAssumptions, onSaveMappings }: {
  assumptions: AnalysisAssumptions;
  form: { tax_rate: string; cost_of_capital_rate: string; invested_capital_override: string; source_reference: string; notes: string };
  setForm: Dispatch<SetStateAction<{ tax_rate: string; cost_of_capital_rate: string; invested_capital_override: string; source_reference: string; notes: string }>>;
  mappings: MappingRow[];
  drafts: Record<number, MappingDraft>;
  setDrafts: Dispatch<SetStateAction<Record<number, MappingDraft>>>;
  busy: boolean;
  onSaveAssumptions: () => void;
  onSaveMappings: () => void;
}) {
  return <>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Supuestos visibles</span><h2>Variables para impuesto y EVA</h2><p>Las variables faltantes permanecen vacías; el sistema no las inventa.</p></div></div><FormGrid>
      <Field label="Tasa de impuesto (%)"><input type="number" step="0.01" value={form.tax_rate} onChange={(event) => setForm((current) => ({ ...current, tax_rate: event.target.value }))} /></Field>
      <Field label="Costo de capital (%)"><input type="number" step="0.01" value={form.cost_of_capital_rate} onChange={(event) => setForm((current) => ({ ...current, cost_of_capital_rate: event.target.value }))} /></Field>
      <Field label="Capital invertido manual"><input type="number" step="0.01" value={form.invested_capital_override} placeholder="Vacío = activos - pasivos corrientes" onChange={(event) => setForm((current) => ({ ...current, invested_capital_override: event.target.value }))} /></Field>
      <Field label="Fuente de los supuestos" span={2}><input value={form.source_reference} onChange={(event) => setForm((current) => ({ ...current, source_reference: event.target.value }))} /></Field>
      <Field label="Notas" span={2}><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
    </FormGrid><div className="button-row"><button className="button button--primary" disabled={busy} onClick={onSaveAssumptions}><Save size={16} />Guardar supuestos</button></div><p className="muted">Estado: {assumptions.saved ? "supuestos guardados para este contexto" : "valores no guardados o derivados de una fase anterior"}.</p></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Clasificación contable</span><h2>Mapeo de cuentas para forecast y real</h2><p>Es indispensable para distinguir partidas de resultados, activos, pasivos y patrimonio.</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Cuenta</th><th>Naturaleza</th><th>Partida financiera</th><th>Rol para ratios</th><th>Notas</th></tr></thead><tbody>{mappings.map((row) => {
      const draft = drafts[row.account_id] ?? EMPTY_MAPPING;
      return <tr key={row.account_id}><td>{row.account_code} · {row.account_name}<br /><span className="muted">{row.group_code} / {row.element_code}</span></td><td>{row.account_nature}</td><td><select value={draft.statement_section} onChange={(event) => setDrafts((current) => ({ ...current, [row.account_id]: { ...draft, statement_section: event.target.value, ratio_role: event.target.value === "CURRENT_ASSET" ? draft.ratio_role : "" } }))}>{sectionOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></td><td><select disabled={draft.statement_section !== "CURRENT_ASSET"} value={draft.ratio_role} onChange={(event) => setDrafts((current) => ({ ...current, [row.account_id]: { ...draft, ratio_role: event.target.value } }))}>{roleOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></td><td><input value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [row.account_id]: { ...draft, notes: event.target.value } }))} /></td></tr>;
    })}</tbody></table></div><div className="button-row"><button className="button button--primary" disabled={busy} onClick={onSaveMappings}><Save size={16} />Guardar clasificaciones</button></div></section>
  </>;
}

function CompareSelector({ title, side, setSide, exercises, versions, onExercise }: {
  title: string;
  side: CompareSide;
  setSide: Dispatch<SetStateAction<CompareSide>>;
  exercises: BudgetExercise[];
  versions: BudgetVersion[];
  onExercise: (value: string) => void;
}) {
  const selectedVersion = versions.find((item) => item.id === Number(side.version_id));
  return <div className="compare-box"><h3>{title}</h3><Field label="Ejercicio"><select value={side.exercise_id} onChange={(event) => onExercise(event.target.value)}><option value="">Seleccione</option>{exercises.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.budget_year}</option>)}</select></Field><Field label="Versión"><select value={side.version_id} onChange={(event) => { const next = versions.find((item) => item.id === Number(event.target.value)); setSide((current) => ({ ...current, version_id: event.target.value, source_type: next?.version_type === "FORECAST" ? "FORECAST" : "ORIGINAL" })); }}><option value="">Seleccione</option>{versions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.version_type}</option>)}</select></Field><Field label="Fuente"><select value={side.source_type} onChange={(event) => setSide((current) => ({ ...current, source_type: event.target.value as AnalysisSourceType }))}>{sourceOptions(selectedVersion).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label="Periodo"><select value={side.period_number} onChange={(event) => setSide((current) => ({ ...current, period_number: event.target.value }))}><option value="">Total anual / cierre</option>{months.map((name, index) => <option key={name} value={index + 1}>{index + 1} · {name}</option>)}</select></Field></div>;
}
