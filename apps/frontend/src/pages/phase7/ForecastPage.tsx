import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, RefreshCw, Save, TrendingUp } from "lucide-react";
import { apiRequest, patchJson, postJson } from "../../lib/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Field, FormGrid, Message } from "../../components/phase2/Ui";
import type { ForecastDetail, ForecastLine, ForecastListItem, Responsible } from "./types";
import "../../phase7-forecast.css";

function money(value: number | null, currency = "PEN") {
  if (value === null) return "Sin dato";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function ForecastPage() {
  const { companyId, exerciseId, exercise, versions, periods, refreshVersions, setVersionId } = useWorkspace();
  const originals = versions.filter((item) => item.version_type === "ORIGINAL" && ["APROBADO", "CERRADO"].includes(item.status));
  const [forecasts, setForecasts] = useState<ForecastListItem[]>([]);
  const [detail, setDetail] = useState<ForecastDetail | null>(null);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createForm, setCreateForm] = useState({ original_version_id: "", cutoff_period_number: "", code: "", name: "", responsible_id: "", observation: "" });
  const [approval, setApproval] = useState({ responsible_id: "", observation: "" });
  const [drafts, setDrafts] = useState<Record<number, { projected_value: string; comment: string; source_reference: string; responsible_id: string }>>({});

  const loadList = async () => {
    if (!companyId || !exerciseId) { setForecasts([]); setDetail(null); return; }
    const [rows, responsibleRows] = await Promise.all([
      apiRequest<ForecastListItem[]>(`/api/forecasts?company_id=${companyId}&exercise_id=${exerciseId}`),
      apiRequest<Responsible[]>(`/api/catalog/responsables?company_id=${companyId}`),
    ]);
    setForecasts(rows);
    setResponsibles(responsibleRows.filter((item) => item.active));
    setCreateForm((current) => ({
      ...current,
      original_version_id: current.original_version_id || String(originals[0]?.id ?? ""),
      cutoff_period_number: current.cutoff_period_number || String(periods[0]?.period_number ?? 1),
      responsible_id: current.responsible_id || String(responsibleRows.find((item) => item.active)?.id ?? ""),
    }));
    setSelectedId((current) => rows.some((item) => item.id === current) ? current : (rows[0]?.id ?? null));
  };

  const loadDetail = async (id: number | null) => {
    if (!id) { setDetail(null); setDrafts({}); return; }
    const result = await apiRequest<ForecastDetail>(`/api/forecasts/${id}`);
    setDetail(result);
    setDrafts(Object.fromEntries(result.rows.map((row) => [row.id, {
      projected_value: row.projected_value === null ? "" : String(row.projected_value),
      comment: row.comment ?? "",
      source_reference: row.source_reference ?? "Proyección revisada",
      responsible_id: row.responsible_id ? String(row.responsible_id) : "",
    }])));
    setApproval((current) => ({ ...current, responsible_id: current.responsible_id || String(result.version.responsible_id ?? responsibles[0]?.id ?? "") }));
  };

  useEffect(() => { void loadList().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar los forecasts.")); }, [companyId, exerciseId, versions.length]);
  useEffect(() => { void loadDetail(selectedId).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar el forecast.")); }, [selectedId]);

  const createForecast = async () => {
    if (!companyId || !exerciseId) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      if (!createForm.original_version_id || !createForm.cutoff_period_number || !createForm.code.trim() || !createForm.name.trim() || !createForm.responsible_id || !createForm.observation.trim()) {
        throw new Error("Complete versión original, mes de corte, código, nombre, responsable y observación.");
      }
      const result = await postJson<{ id: number; revision_number: number; message: string }>("/api/forecasts", {
        company_id: companyId, exercise_id: exerciseId,
        original_version_id: Number(createForm.original_version_id), cutoff_period_number: Number(createForm.cutoff_period_number),
        code: createForm.code, name: createForm.name, responsible_id: Number(createForm.responsible_id), observation: createForm.observation,
      });
      setSuccess(`${result.message} Revisión ${result.revision_number}.`);
      setCreateForm((current) => ({ ...current, code: "", name: "", observation: "" }));
      await refreshVersions(); await loadList(); setSelectedId(result.id); setVersionId(result.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible crear el forecast."); }
    finally { setBusy(false); }
  };

  const saveLine = async (line: ForecastLine) => {
    if (!detail) return;
    const draft = drafts[line.id];
    setBusy(true); setError(""); setSuccess("");
    try {
      if (!draft || draft.projected_value === "" || !draft.source_reference.trim()) throw new Error("Ingrese proyección y fuente.");
      const result = await patchJson<{ message: string }>(`/api/forecasts/${detail.version.id}/lines/${line.id}`, {
        projected_value: Number(draft.projected_value), comment: draft.comment || null,
        source_reference: draft.source_reference, responsible_id: draft.responsible_id ? Number(draft.responsible_id) : null,
      });
      setSuccess(result.message); await loadDetail(detail.version.id); await loadList();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar la proyección."); }
    finally { setBusy(false); }
  };

  const approve = async () => {
    if (!detail) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      if (!approval.responsible_id || !approval.observation.trim()) throw new Error("Seleccione responsable e ingrese observación.");
      const result = await postJson<{ message: string }>(`/api/forecasts/${detail.version.id}/approve`, {
        responsible_id: Number(approval.responsible_id), observation: approval.observation,
      });
      setSuccess(result.message); await refreshVersions(); await loadList(); await loadDetail(detail.version.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible aprobar el forecast."); }
    finally { setBusy(false); }
  };

  const selected = forecasts.find((item) => item.id === selectedId) ?? null;
  const locked = detail?.version.status !== "BORRADOR";
  const projectedRows = useMemo(() => detail?.rows.filter((row) => row.value_origin === "PROYECCION") ?? [], [detail]);

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 7 · Forecast</span><h1>Presupuesto revisado por mes de corte</h1><p>Hasta el corte se conserva información real; después del corte se usan proyecciones editables.</p></div><TrendingUp size={28} /></section>
    {error && <Message type="danger">{error}</Message>}{success && <Message type="success">{success}</Message>}
    {!companyId || !exerciseId ? <Message>Seleccione empresa y ejercicio en la barra superior.</Message> : null}
    {companyId && exerciseId && <>
      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Nueva revisión</span><h2>Crear versión forecast</h2><p>La versión original debe estar aprobada o cerrada y debe existir información real completa hasta el corte.</p></div><Plus size={22} /></div>
        {originals.length ? <><FormGrid>
          <Field label="Versión original"><select value={createForm.original_version_id} onChange={(event) => setCreateForm((current) => ({ ...current, original_version_id: event.target.value }))}><option value="">Seleccione</option>{originals.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.status}</option>)}</select></Field>
          <Field label="Mes de corte"><select value={createForm.cutoff_period_number} onChange={(event) => setCreateForm((current) => ({ ...current, cutoff_period_number: event.target.value }))}><option value="">Seleccione</option>{periods.map((item) => <option key={item.id} value={item.period_number}>{item.period_number} · {item.name}</option>)}</select></Field>
          <Field label="Código"><input value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value }))} placeholder="FC-2027-01" /></Field>
          <Field label="Nombre" span={2}><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Responsable"><select value={createForm.responsible_id} onChange={(event) => setCreateForm((current) => ({ ...current, responsible_id: event.target.value }))}><option value="">Seleccione</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field>
          <Field label="Observación" span={2}><textarea value={createForm.observation} onChange={(event) => setCreateForm((current) => ({ ...current, observation: event.target.value }))} /></Field>
        </FormGrid><div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void createForecast()}><Plus size={16} />Crear forecast</button></div></> : <Message>Primero apruebe una versión original para habilitar la creación del forecast.</Message>}
      </section>

      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Versionamiento</span><h2>Revisiones forecast</h2></div><button className="button button--ghost" disabled={busy} onClick={() => void loadList()}><RefreshCw size={16} />Actualizar</button></div><div className="forecast-version-grid">{forecasts.length ? forecasts.map((item) => <button key={item.id} className={`forecast-version-card ${item.id === selectedId ? "forecast-version-card--active" : ""}`} onClick={() => setSelectedId(item.id)}><strong>{item.code}</strong><span>Revisión {item.revision_number} · corte {item.cutoff_period_name}</span><small>{item.status} · origen {item.source_version_code}</small></button>) : <p className="muted">Todavía no existen versiones forecast.</p>}</div></section>

      {detail && selected && <>
        <section className="metric-grid phase7-summary"><Metric label="Original anual" value={money(detail.summary.annual.original_budget, exercise?.currency_code)} /><Metric label="Real hasta corte" value={money(detail.summary.annual.actual_to_cutoff, exercise?.currency_code)} /><Metric label="Forecast anual" value={money(detail.summary.annual.forecast_value, exercise?.currency_code)} /><Metric label="Diferencia" value={money(detail.summary.annual.difference, exercise?.currency_code)} /></section>
        <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Comparación mensual</span><h2>{detail.version.code} · revisión {detail.version.revision_number}</h2><p>Mes de corte: {detail.version.cutoff_period_number}. Los meses reales están protegidos.</p></div><span className={`status-pill ${locked ? "status-pill--warning" : "status-pill--success"}`}>{detail.version.status}</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Mes</th><th>Origen</th><th>Original</th><th>Real</th><th>Forecast</th><th>Diferencia</th></tr></thead><tbody>{detail.summary.monthly.map((row) => <tr key={row.period_number}><td>{row.period_number} · {row.period_name}</td><td>{row.value_origin}</td><td>{money(row.original_budget, exercise?.currency_code)}</td><td>{money(row.actual_value, exercise?.currency_code)}</td><td>{money(row.forecast_value, exercise?.currency_code)}</td><td>{money(row.difference, exercise?.currency_code)}</td></tr>)}</tbody></table></div></section>

        <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Detalle futuro</span><h2>Proyecciones posteriores al corte</h2><p>Las filas de origen REAL son de solo lectura y no pueden reemplazarse.</p></div></div><div className="forecast-line-list">{projectedRows.map((line) => { const draft = drafts[line.id]; return <article className="forecast-line-card" key={line.id}><header><div><strong>{line.period_number} · {line.period_name}</strong><span>{line.center_code} · {line.account_code}</span></div><small>{line.group_code} / {line.element_code}</small></header><div className="forecast-line-values"><span>Original: {money(line.original_budget, exercise?.currency_code)}</span><span>Forecast: {money(line.forecast_value, exercise?.currency_code)}</span><span>Diferencia: {money(line.difference, exercise?.currency_code)}</span></div><FormGrid><Field label="Proyección"><input type="number" step="0.01" disabled={locked} value={draft?.projected_value ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...current[line.id], projected_value: event.target.value } }))} /></Field><Field label="Fuente de la proyección" span={2}><input disabled={locked} value={draft?.source_reference ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...current[line.id], source_reference: event.target.value } }))} /></Field><Field label="Responsable"><select disabled={locked} value={draft?.responsible_id ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...current[line.id], responsible_id: event.target.value } }))}><option value="">Sin asignar</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field><Field label="Comentario" span={2}><textarea disabled={locked} value={draft?.comment ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...current[line.id], comment: event.target.value } }))} /></Field></FormGrid>{!locked && <div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void saveLine(line)}><Save size={16} />Guardar proyección</button></div>}</article>; })}</div></section>

        <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Aprobación</span><h2>Responsable y bloqueo de la revisión</h2></div><CheckCircle2 size={22} /></div>{locked ? <Message type="success">La revisión está {detail.version.status.toLowerCase()} y no admite cambios.</Message> : <><FormGrid><Field label="Responsable"><select value={approval.responsible_id} onChange={(event) => setApproval((current) => ({ ...current, responsible_id: event.target.value }))}><option value="">Seleccione</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field><Field label="Observación de aprobación" span={2}><textarea value={approval.observation} onChange={(event) => setApproval((current) => ({ ...current, observation: event.target.value }))} /></Field></FormGrid><div className="button-row"><button className="button button--primary" disabled={busy || !detail.summary.complete} onClick={() => void approve()}><CheckCircle2 size={16} />Aprobar forecast</button></div>{!detail.summary.complete && <p className="muted">El forecast contiene líneas incompletas.</p>}</>}</section>
      </>}
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><div><span>{label}</span><strong>{value}</strong></div></article>; }
