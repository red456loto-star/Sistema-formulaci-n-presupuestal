import { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, Copy, Plus, Save, Trash2 } from "lucide-react";
import { apiRequest, deleteRequest, patchJson, postJson } from "../../lib/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Field, FormGrid, Message } from "../../components/phase2/Ui";
import type {
  ActivityCenter, Currency, OrganizationHierarchy, OriginalBudgetLine, OriginalSummary, Responsible,
} from "./types";
import "../../phase5-budget.css";

interface Unit { id: number; code: string; name: string; active: number; }

const emptySummary: OriginalSummary = { line_count: 0, total_budgeted: 0, total_real: null, variance: null, complete_lines: 0, can_approve: false };

function numericInput(value: string) {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatAmount(value: number | null, currency = "PEN") {
  if (value === null) return "Sin dato real";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function OriginalBudgetPage() {
  const { companyId, company, exerciseId, exercise, versionId, version, refreshVersions } = useWorkspace();
  const [hierarchy, setHierarchy] = useState<OrganizationHierarchy | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [lines, setLines] = useState<OriginalBudgetLine[]>([]);
  const [summary, setSummary] = useState<OriginalSummary>(emptySummary);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<OriginalBudgetLine | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [annualTotal, setAnnualTotal] = useState("");
  const [growthRates, setGrowthRates] = useState(["0", "0", "0"]);
  const [copySourceId, setCopySourceId] = useState("");
  const [copyReal, setCopyReal] = useState(false);
  const [approvalResponsible, setApprovalResponsible] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [filters, setFilters] = useState({ center: "", group: "", element: "", account: "" });
  const [newLine, setNewLine] = useState({ center: "", account: "", currency: "", unit: "", responsible: "", comment: "", support: "", source: "" });

  const contextReady = Boolean(companyId && exerciseId && versionId && version?.version_type === "ORIGINAL");
  const locked = version?.status !== "BORRADOR";
  const centers = useMemo(() => hierarchy?.organizational.flatMap((site) => site.centers) ?? [], [hierarchy]);
  const groups = hierarchy?.budget ?? [];
  const elements = useMemo(() => groups.flatMap((group) => group.elements), [groups]);
  const accounts = useMemo(() => elements.flatMap((element) => element.accounts), [elements]);
  const selectedCenter = centers.find((item) => item.id === Number(newLine.center));
  const availableAccounts = selectedCenter
    ? selectedCenter.budget.flatMap((group) => group.elements.flatMap((element) => element.accounts))
    : accounts;

  const loadData = async () => {
    if (!companyId || !exerciseId || !versionId || version?.version_type !== "ORIGINAL") {
      setLines([]); setSummary(emptySummary); setHierarchy(null); return;
    }
    const params = new URLSearchParams({ company_id: String(companyId), exercise_id: String(exerciseId), version_id: String(versionId) });
    if (filters.center) params.set("center_id", filters.center);
    if (filters.group) params.set("group_id", filters.group);
    if (filters.element) params.set("element_id", filters.element);
    if (filters.account) params.set("account_id", filters.account);
    const [organization, currencyRows, unitRows, responsibleRows, lineRows, summaryRow] = await Promise.all([
      apiRequest<OrganizationHierarchy>(`/api/organization/hierarchy?company_id=${companyId}`),
      apiRequest<Currency[]>("/api/catalog/monedas"),
      apiRequest<Unit[]>("/api/catalog/unidades"),
      apiRequest<Responsible[]>(`/api/catalog/responsables?company_id=${companyId}`),
      apiRequest<OriginalBudgetLine[]>(`/api/budget-original/lines?${params}`),
      apiRequest<OriginalSummary>(`/api/budget-original/summary?${params}`),
    ]);
    setHierarchy(organization);
    setCurrencies(currencyRows.filter((item) => item.active));
    setUnits(unitRows.filter((item) => item.active));
    setResponsibles(responsibleRows.filter((item) => item.active));
    setLines(lineRows);
    setSummary(summaryRow);
    setNewLine((current) => ({
      ...current,
      currency: current.currency || String(exercise?.currency_id ?? currencyRows.find((item) => item.active)?.id ?? ""),
    }));
    setSelectedId((current) => lineRows.some((item) => item.id === current) ? current : (lineRows[0]?.id ?? null));
  };

  useEffect(() => {
    void loadData().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar el presupuesto original."));
  }, [companyId, exerciseId, versionId, version?.status, filters.center, filters.group, filters.element, filters.account]);

  useEffect(() => {
    const line = lines.find((item) => item.id === selectedId) ?? null;
    setDraft(line ? structuredClone(line) : null);
    setAnnualTotal(line ? String(line.annual_budgeted) : "");
  }, [selectedId, lines]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError(""); setSuccess("");
    try { await task(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible completar la operación."); }
    finally { setBusy(false); }
  };

  const createLine = () => run(async () => {
    if (!companyId || !exerciseId || !versionId) return;
    if (!newLine.center || !newLine.account || !newLine.currency) throw new Error("Seleccione centro, cuenta y moneda.");
    const result = await postJson<{ id: number; message: string }>("/api/budget-original/lines", {
      company_id: companyId,
      exercise_id: exerciseId,
      version_id: versionId,
      center_id: Number(newLine.center),
      account_id: Number(newLine.account),
      currency_id: Number(newLine.currency),
      unit_id: newLine.unit ? Number(newLine.unit) : null,
      responsible_id: newLine.responsible ? Number(newLine.responsible) : null,
      comment: newLine.comment || null,
      support: newLine.support || null,
      source: newLine.source || null,
    });
    setSuccess(result.message);
    setNewLine((current) => ({ ...current, account: "", unit: "", comment: "", support: "", source: "" }));
    await loadData();
    setSelectedId(result.id);
  });

  const saveDraft = () => run(async () => {
    if (!draft) return;
    const result = await patchJson<{ message: string }>(`/api/budget-original/lines/${draft.id}`, {
      center_id: draft.center_id,
      account_id: draft.account_id,
      currency_id: draft.currency_id,
      unit_id: draft.unit_id ?? null,
      responsible_id: draft.responsible_id ?? null,
      comment: draft.comment ?? null,
      support: draft.support ?? null,
      source: draft.source_text ?? null,
      monthly_values: draft.monthly_values.map((item) => ({ period_id: item.period_id, budgeted_value: item.budgeted_value, real_value: item.real_value })),
      projections: draft.projections.map((item) => ({ projection_year_id: item.projection_year_id, budgeted_value: item.budgeted_value, real_value: item.real_value })),
    });
    setSuccess(result.message);
    await loadData();
  });

  const distribute = () => run(async () => {
    if (!draft) return;
    const total = numericInput(annualTotal);
    if (total === null) throw new Error("Ingrese un total anual numérico.");
    const result = await postJson<{ message: string }>(`/api/budget-original/lines/${draft.id}/distribute`, { annual_total: total });
    setSuccess(result.message); await loadData();
  });

  const project = () => run(async () => {
    if (!draft) return;
    const rates = growthRates.map(numericInput);
    if (rates.some((item) => item === null)) throw new Error("Ingrese las tres tasas de crecimiento.");
    const result = await postJson<{ message: string }>(`/api/budget-original/lines/${draft.id}/project`, { rates });
    setSuccess(result.message); await loadData();
  });

  const copyValues = () => run(async () => {
    if (!draft || !copySourceId) throw new Error("Seleccione una línea de origen.");
    const result = await postJson<{ message: string }>(`/api/budget-original/lines/${draft.id}/copy`, { source_line_id: Number(copySourceId), include_real: copyReal });
    setSuccess(result.message); await loadData();
  });

  const removeLine = () => run(async () => {
    if (!draft || !window.confirm(`¿Eliminar la línea ${draft.account_code} - ${draft.account_name}?`)) return;
    const result = await deleteRequest<{ message: string }>(`/api/budget-original/lines/${draft.id}`);
    setSuccess(result.message); setSelectedId(null); await loadData();
  });

  const approve = () => run(async () => {
    if (!companyId || !exerciseId || !versionId || !approvalResponsible || !approvalNotes.trim()) throw new Error("Seleccione responsable e ingrese la observación de aprobación.");
    const result = await postJson<{ message: string }>("/api/budget-original/approve", {
      company_id: companyId,
      exercise_id: exerciseId,
      version_id: versionId,
      responsible_id: Number(approvalResponsible),
      notes: approvalNotes,
    });
    setSuccess(result.message); await refreshVersions(); await loadData();
  });

  const updateMonth = (index: number, field: "budgeted_value" | "real_value", raw: string) => {
    const value = numericInput(raw);
    setDraft((current) => current ? ({ ...current, monthly_values: current.monthly_values.map((item, position) => position === index ? { ...item, [field]: value ?? (field === "budgeted_value" ? 0 : null) } : item) }) : current);
  };

  const updateProjection = (index: number, field: "budgeted_value" | "real_value", raw: string) => {
    const value = numericInput(raw);
    setDraft((current) => current ? ({ ...current, projections: current.projections.map((item, position) => position === index ? { ...item, [field]: value ?? (field === "budgeted_value" ? 0 : null) } : item) }) : current);
  };

  const draftBudgeted = draft?.monthly_values.reduce((sum, item) => sum + Number(item.budgeted_value || 0), 0) ?? 0;
  const draftRealValues = draft?.monthly_values.filter((item) => item.real_value !== null) ?? [];
  const draftReal = draftRealValues.length ? draftRealValues.reduce((sum, item) => sum + Number(item.real_value), 0) : null;
  const currencyCode = draft?.currency_code ?? exercise?.currency_code ?? "PEN";

  return <div className="page-stack">
    <section className="page-heading">
      <div><span className="eyebrow">Fase 5 · Presupuesto original</span><h1>Presupuesto anual mensualizado</h1><p>Capture presupuesto y valor real por mes, obtenga el total anual y proyecte los tres años posteriores.</p></div>
      <span className={`status-pill ${locked ? "status-pill--warning" : "status-pill--success"}`}>{locked ? `Versión ${version?.status ?? "no disponible"}` : "Versión editable"}</span>
    </section>

    {error && <Message type="danger">{error}</Message>}
    {success && <Message type="success">{success}</Message>}
    {!companyId || !exerciseId ? <Message>Seleccione empresa y ejercicio en la barra superior.</Message> : null}
    {version && version.version_type !== "ORIGINAL" ? <Message type="danger">Seleccione una versión de tipo ORIGINAL. El forecast permanece fuera de esta fase.</Message> : null}
    {!version ? <Message>Seleccione una versión original en la barra superior.</Message> : null}

    {contextReady && <>
      <section className="metric-grid original-summary-grid">
        <Metric label="Líneas" value={String(summary.line_count)} />
        <Metric label="Presupuestado anual" value={formatAmount(summary.total_budgeted, exercise?.currency_code)} />
        <Metric label="Real registrado" value={formatAmount(summary.total_real, exercise?.currency_code)} />
        <Metric label="Variación real - presupuesto" value={formatAmount(summary.variance, exercise?.currency_code)} />
      </section>

      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Filtros</span><h2>Contexto de consulta</h2></div></div>
        <FormGrid>
          <Field label="Centro"><select value={filters.center} onChange={(event) => setFilters((current) => ({ ...current, center: event.target.value }))}><option value="">Todos</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Grupo"><select value={filters.group} onChange={(event) => setFilters((current) => ({ ...current, group: event.target.value, element: "", account: "" }))}><option value="">Todos</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Elemento"><select value={filters.element} onChange={(event) => setFilters((current) => ({ ...current, element: event.target.value, account: "" }))}><option value="">Todos</option>{elements.filter((item) => !filters.group || item.group_id === Number(filters.group)).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Cuenta"><select value={filters.account} onChange={(event) => setFilters((current) => ({ ...current, account: event.target.value }))}><option value="">Todas</option>{accounts.filter((item) => !filters.element || item.element_id === Number(filters.element)).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        </FormGrid>
      </section>

      {!locked && <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Nueva línea</span><h2>Dimensiones presupuestales</h2></div><Plus size={22} /></div>
        <FormGrid>
          <Field label="Centro"><select value={newLine.center} onChange={(event) => { const center = centers.find((item) => item.id === Number(event.target.value)); setNewLine((current) => ({ ...current, center: event.target.value, account: "", responsible: center ? String(center.responsible_id) : current.responsible })); }}><option value="">Seleccione</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Cuenta"><select value={newLine.account} onChange={(event) => setNewLine((current) => ({ ...current, account: event.target.value }))}><option value="">Seleccione</option>{availableAccounts.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Moneda"><select value={newLine.currency} onChange={(event) => setNewLine((current) => ({ ...current, currency: event.target.value }))}><option value="">Seleccione</option>{currencies.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Unidad de medida"><select value={newLine.unit} onChange={(event) => setNewLine((current) => ({ ...current, unit: event.target.value }))}><option value="">No aplica</option>{units.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Responsable"><select value={newLine.responsible} onChange={(event) => setNewLine((current) => ({ ...current, responsible: event.target.value }))}><option value="">Sin asignar</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field>
          <Field label="Comentario" span={2}><textarea value={newLine.comment} onChange={(event) => setNewLine((current) => ({ ...current, comment: event.target.value }))} /></Field>
          <Field label="Sustento" span={2}><textarea value={newLine.support} onChange={(event) => setNewLine((current) => ({ ...current, support: event.target.value }))} /></Field>
          <Field label="Fuente" span={2}><input value={newLine.source} onChange={(event) => setNewLine((current) => ({ ...current, source: event.target.value }))} placeholder="Supuesto presupuestal, documento o referencia" /></Field>
        </FormGrid>
        <div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void createLine()}><Plus size={16} />Crear línea</button></div>
      </section>}

      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Líneas registradas</span><h2>Presupuesto y valor real</h2></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Centro</th><th>Grupo / elemento</th><th>Cuenta</th><th>Presupuestado</th><th>Real</th><th>Variación</th><th></th></tr></thead><tbody>
          {lines.length ? lines.map((line) => <tr key={line.id} className={line.id === selectedId ? "selected-row" : ""}><td>{line.center_code}<br /><span className="muted">{line.center_name}</span></td><td>{line.group_code} · {line.group_name}<br /><span className="muted">{line.element_code} · {line.element_name}</span></td><td>{line.account_code}<br /><span className="muted">{line.account_name}</span></td><td>{formatAmount(line.annual_budgeted, line.currency_code)}</td><td>{formatAmount(line.annual_real, line.currency_code)}</td><td>{formatAmount(line.annual_variance, line.currency_code)}</td><td><button className="button button--ghost" onClick={() => setSelectedId(line.id)}>Abrir</button></td></tr>) : <tr><td colSpan={7} className="table-empty">No existen líneas para los filtros seleccionados.</td></tr>}
        </tbody></table></div>
      </section>

      {draft && <section className="panel original-editor">
        <div className="panel__heading"><div><span className="eyebrow">Edición detallada</span><h2>{draft.account_code} · {draft.account_name}</h2><p>{draft.center_code} · {draft.center_name} | {draft.group_name} / {draft.element_name}</p></div>{!locked && <div className="button-row"><button className="button button--ghost" onClick={() => void removeLine()}><Trash2 size={16} />Eliminar</button><button className="button button--primary" onClick={() => void saveDraft()} disabled={busy}><Save size={16} />Guardar</button></div>}</div>

        <FormGrid>
          <Field label="Responsable"><select value={draft.responsible_id ?? ""} disabled={locked} onChange={(event) => setDraft((current) => current ? ({ ...current, responsible_id: event.target.value ? Number(event.target.value) : null }) : current)}><option value="">Sin asignar</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field>
          <Field label="Unidad"><select value={draft.unit_id ?? ""} disabled={locked} onChange={(event) => setDraft((current) => current ? ({ ...current, unit_id: event.target.value ? Number(event.target.value) : null }) : current)}><option value="">No aplica</option>{units.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Comentario" span={2}><textarea disabled={locked} value={draft.comment ?? ""} onChange={(event) => setDraft((current) => current ? ({ ...current, comment: event.target.value }) : current)} /></Field>
          <Field label="Sustento" span={2}><textarea disabled={locked} value={draft.support ?? ""} onChange={(event) => setDraft((current) => current ? ({ ...current, support: event.target.value }) : current)} /></Field>
          <Field label="Fuente" span={2}><input disabled={locked} value={draft.source_text ?? ""} onChange={(event) => setDraft((current) => current ? ({ ...current, source_text: event.target.value }) : current)} /></Field>
        </FormGrid>

        <div className="editor-totals"><Metric label="Total presupuestado" value={formatAmount(draftBudgeted, currencyCode)} /><Metric label="Total real" value={formatAmount(draftReal, currencyCode)} /><Metric label="Variación" value={formatAmount(draftReal === null ? null : draftReal - draftBudgeted, currencyCode)} /></div>

        {!locked && <div className="operation-strip"><Field label="Total anual a distribuir"><input type="number" step="0.01" value={annualTotal} onChange={(event) => setAnnualTotal(event.target.value)} /></Field><button className="button button--ghost" onClick={() => void distribute()} disabled={busy}><Calculator size={16} />Distribuir en meses abiertos</button><Field label="Copiar desde"><select value={copySourceId} onChange={(event) => setCopySourceId(event.target.value)}><option value="">Seleccione</option>{lines.filter((item) => item.id !== draft.id).map((item) => <option key={item.id} value={item.id}>{item.center_code} · {item.account_code}</option>)}</select></Field><label className="check-line"><input type="checkbox" checked={copyReal} onChange={(event) => setCopyReal(event.target.checked)} />Copiar también valores reales</label><button className="button button--ghost" onClick={() => void copyValues()}><Copy size={16} />Copiar valores</button></div>}

        <h3>Detalle mensual</h3>
        <div className="month-grid">{draft.monthly_values.map((item, index) => <article className={`month-card ${item.period_status === "CERRADO" ? "month-card--closed" : ""}`} key={item.period_id}><div><strong>{String(item.period_number).padStart(2, "0")} · {item.period_name}</strong><span>{item.period_status}</span></div><label>Presupuestado<input type="number" step="0.01" disabled={locked || item.period_status === "CERRADO"} value={item.budgeted_value} onChange={(event) => updateMonth(index, "budgeted_value", event.target.value)} /></label><label>Real<input type="number" step="0.01" disabled={locked || item.period_status === "CERRADO"} value={item.real_value ?? ""} placeholder="Vacío" onChange={(event) => updateMonth(index, "real_value", event.target.value)} /></label><small>Diferencia: {formatAmount(item.real_value === null ? null : item.real_value - item.budgeted_value, currencyCode)}</small></article>)}</div>

        <div className="projection-heading"><div><h3>Proyección anual de tres años</h3><p className="muted">La proyección es anual, no mensual.</p></div>{!locked && <div className="growth-controls">{growthRates.map((rate, index) => <Field key={index} label={`Tasa año +${index + 1} (%)`}><input type="number" step="0.01" value={rate} onChange={(event) => setGrowthRates((current) => current.map((item, position) => position === index ? event.target.value : item))} /></Field>)}<button className="button button--ghost" onClick={() => void project()}><Calculator size={16} />Proyectar</button></div>}</div>
        <div className="projection-grid">{draft.projections.map((item, index) => <article className="projection-card" key={item.projection_year_id}><strong>{item.year}</strong><span>{item.description}</span><label>Presupuestado<input type="number" step="0.01" disabled={locked} value={item.budgeted_value} onChange={(event) => updateProjection(index, "budgeted_value", event.target.value)} /></label><label>Real<input type="number" step="0.01" disabled={locked} value={item.real_value ?? ""} placeholder="Vacío" onChange={(event) => updateProjection(index, "real_value", event.target.value)} /></label></article>)}</div>
      </section>}

      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Aprobación</span><h2>Responsable y bloqueo</h2><p>Al aprobar, la versión queda en modo de consulta.</p></div><CheckCircle2 size={22} /></div>
        {locked ? <Message type="success">La versión está {version?.status?.toLowerCase()} y no puede editarse directamente.</Message> : <><FormGrid><Field label="Responsable aprobador"><select value={approvalResponsible} onChange={(event) => setApprovalResponsible(event.target.value)}><option value="">Seleccione</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field><Field label="Observación de aprobación" span={2}><textarea value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} /></Field></FormGrid><div className="button-row"><button className="button button--primary" disabled={busy || !summary.can_approve} onClick={() => void approve()}><CheckCircle2 size={16} />Aprobar presupuesto original</button></div>{!summary.can_approve && <p className="muted">Para aprobar debe existir al menos una línea y cada línea debe contener doce meses y tres proyecciones.</p>}</>}
      </section>
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric-card"><div><span>{label}</span><strong>{value}</strong></div></article>;
}
