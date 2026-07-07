import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Gauge, RefreshCw, Scale, Target, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API_BASE_URL, apiRequest } from "../../lib/api";
import type { AggregatedRow, ComparisonType, Phase9Analysis, Phase9Filters, Phase9Options, ScenarioKpis, TrendRow, VarianceStatus } from "./types";

const tabNames = ["Dashboard", "Variaciones", "Relevancia de costos"];
type Phase9Tab = typeof tabNames[number];

const comparisonLabels: Record<ComparisonType, string> = {
  ORIGINAL_REAL: "Presupuesto original vs real",
  ORIGINAL_FORECAST: "Presupuesto original vs forecast",
  FORECAST_REAL: "Forecast vs real",
};

const EMPTY_OPTIONS: Phase9Options = {
  centers: [], groups: [], elements: [], accounts: [], original_versions: [], forecast_versions: [], budget_types: [],
};

export function Phase9Page({ initialTab = "Dashboard" }: { initialTab?: Phase9Tab }) {
  const { companyId, exerciseId, period, versionId, versions } = useWorkspace();
  const [tab, setTab] = useState<Phase9Tab>(initialTab);
  const [options, setOptions] = useState<Phase9Options>(EMPTY_OPTIONS);
  const [comparison, setComparison] = useState<ComparisonType>("ORIGINAL_REAL");
  const [originalVersionId, setOriginalVersionId] = useState("");
  const [forecastVersionId, setForecastVersionId] = useState("");
  const [periodNumber, setPeriodNumber] = useState("");
  const [centerId, setCenterId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [elementId, setElementId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [budgetType, setBudgetType] = useState("");
  const [materiality, setMateriality] = useState("10");
  const [analysis, setAnalysis] = useState<Phase9Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => setPeriodNumber(period ? String(period.period_number) : ""), [period?.id]);

  useEffect(() => {
    if (!companyId || !exerciseId) {
      setOptions(EMPTY_OPTIONS); setOriginalVersionId(""); setForecastVersionId(""); setAnalysis(null); return;
    }
    setBusy(true); setError("");
    apiRequest<Phase9Options>(`/api/phase9/options?company_id=${companyId}&exercise_id=${exerciseId}`)
      .then((result) => {
        setOptions(result);
        const activeVersion = versions.find((item) => item.id === versionId);
        const selectedForecast = activeVersion?.version_type === "FORECAST"
          ? result.forecast_versions.find((item) => item.id === activeVersion.id)
          : undefined;
        const preferredOriginal = activeVersion?.version_type === "ORIGINAL"
          ? result.original_versions.find((item) => item.id === activeVersion.id)
          : result.original_versions.find((item) => item.id === selectedForecast?.original_version_id);
        const original = preferredOriginal ?? result.original_versions[0];
        const forecast = selectedForecast ?? result.forecast_versions.find((item) => item.original_version_id === original?.id) ?? result.forecast_versions[0];
        setOriginalVersionId(original ? String(original.id) : "");
        setForecastVersionId(forecast ? String(forecast.id) : "");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar los filtros de control presupuestal."))
      .finally(() => setBusy(false));
  }, [companyId, exerciseId, versionId]);

  useEffect(() => {
    if (!originalVersionId) return;
    const compatible = options.forecast_versions.filter((item) => item.original_version_id === Number(originalVersionId));
    if (!compatible.some((item) => item.id === Number(forecastVersionId))) setForecastVersionId(compatible[0] ? String(compatible[0].id) : "");
  }, [originalVersionId, options.forecast_versions]);

  const filteredElements = useMemo(() => options.elements.filter((item) => !groupId || item.group_id === Number(groupId)), [options.elements, groupId]);
  const filteredAccounts = useMemo(() => options.accounts.filter((item) => !elementId || item.element_id === Number(elementId)), [options.accounts, elementId]);
  const compatibleForecasts = useMemo(() => options.forecast_versions.filter((item) => !originalVersionId || item.original_version_id === Number(originalVersionId)), [options.forecast_versions, originalVersionId]);

  const requestBody = (): Phase9Filters => {
    if (!companyId || !exerciseId || !originalVersionId) throw new Error("Seleccione empresa, ejercicio y versión original.");
    if (comparison !== "ORIGINAL_REAL" && !forecastVersionId) throw new Error("Seleccione una versión forecast para esta comparación.");
    return {
      company_id: companyId,
      exercise_id: exerciseId,
      original_version_id: Number(originalVersionId),
      forecast_version_id: forecastVersionId ? Number(forecastVersionId) : null,
      period_number: periodNumber ? Number(periodNumber) : null,
      center_id: centerId ? Number(centerId) : null,
      group_id: groupId ? Number(groupId) : null,
      element_id: elementId ? Number(elementId) : null,
      account_id: accountId ? Number(accountId) : null,
      budget_type: budgetType || null,
      comparison,
      materiality_threshold: Number(materiality || 10),
    };
  };

  const analyze = async () => {
    setBusy(true); setError("");
    try {
      setAnalysis(await apiRequest<Phase9Analysis>("/api/phase9/analyze", { method: "POST", body: JSON.stringify(requestBody()) }));
    } catch (reason) {
      setAnalysis(null);
      setError(reason instanceof Error ? reason.message : "No fue posible calcular las variaciones.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (companyId && exerciseId && originalVersionId && (comparison === "ORIGINAL_REAL" || forecastVersionId)) void analyze();
  }, [companyId, exerciseId, originalVersionId, forecastVersionId]);

  const exportExcel = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/phase9/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "No fue posible exportar los resultados.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `variaciones-dashboard-${analysis?.context.original_version_code ?? "fase-9"}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible exportar los resultados."); }
    finally { setBusy(false); }
  };

  const currency = analysis?.context.currency_code ?? "PEN";
  return <div className="page-stack phase9-page">
    <section className="page-heading">
      <div><span className="eyebrow">Fase 9 · Control y evaluación presupuestal</span><h1>Variaciones, relevancia de costos y dashboard</h1><p>Compara presupuesto original, información real y forecast con trazabilidad hasta centro, grupo, elemento y cuenta.</p></div>
      <div className="button-row"><button className="button button--ghost" disabled={busy || !originalVersionId} onClick={() => void analyze()}><RefreshCw size={16} />Actualizar</button><button className="button button--primary" disabled={busy || !analysis} onClick={() => void exportExcel()}><Download size={16} />Exportar Excel</button></div>
    </section>

    {error && <Message type="danger">{error}</Message>}
    {!companyId || !exerciseId ? <Message>Seleccione una empresa y un ejercicio en la barra superior.</Message> : <>
      <section className="panel phase9-filters">
        <div className="panel__heading"><div><span className="eyebrow">Base de comparación visible</span><h2>{comparisonLabels[comparison]}</h2></div><Scale size={22} /></div>
        <FormGrid>
          <Field label="Tipo de comparación"><select value={comparison} onChange={(event) => { setComparison(event.target.value as ComparisonType); setAnalysis(null); }}><option value="ORIGINAL_REAL">Original vs real</option><option value="ORIGINAL_FORECAST">Original vs forecast</option><option value="FORECAST_REAL">Forecast vs real</option></select></Field>
          <Field label="Versión original"><select value={originalVersionId} onChange={(event) => { setOriginalVersionId(event.target.value); setAnalysis(null); }}><option value="">Seleccione</option>{options.original_versions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.status}</option>)}</select></Field>
          <Field label="Versión forecast"><select value={forecastVersionId} disabled={comparison === "ORIGINAL_REAL"} onChange={(event) => { setForecastVersionId(event.target.value); setAnalysis(null); }}><option value="">Seleccione</option>{compatibleForecasts.map((item) => <option key={item.id} value={item.id}>{item.code} · Rev. {item.revision_number} · corte {item.cutoff_period_number}</option>)}</select></Field>
          <Field label="Periodo"><select value={periodNumber} onChange={(event) => setPeriodNumber(event.target.value)}><option value="">Total anual</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, "0")}</option>)}</select></Field>
          <Field label="Centro"><select value={centerId} onChange={(event) => setCenterId(event.target.value)}><option value="">Todos</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Grupo"><select value={groupId} onChange={(event) => { setGroupId(event.target.value); setElementId(""); setAccountId(""); }}><option value="">Todos</option>{options.groups.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Elemento"><select value={elementId} onChange={(event) => { setElementId(event.target.value); setAccountId(""); }}><option value="">Todos</option>{filteredElements.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Cuenta"><select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Todas</option>{filteredAccounts.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Tipo de presupuesto"><select value={budgetType} onChange={(event) => setBudgetType(event.target.value)}><option value="">Todos</option>{options.budget_types.map((item) => <option key={item.budget_type} value={item.budget_type}>{item.budget_type.replaceAll("_", " ")}</option>)}</select></Field>
          <Field label="Umbral de materialidad (%)"><input type="number" min="0.1" max="100" step="0.1" value={materiality} onChange={(event) => setMateriality(event.target.value)} /></Field>
        </FormGrid>
        <div className="phase9-filter-actions"><span className="muted">Una partida es material cuando su participación o su impacto en la variación alcanza el umbral.</span><button className="button button--primary" disabled={busy || !originalVersionId} onClick={() => void analyze()}>{busy ? "Calculando..." : "Aplicar filtros"}</button></div>
      </section>

      <Tabs items={tabNames} active={tab} onChange={(value) => setTab(value as Phase9Tab)} />
      {analysis?.warnings.map((warning) => <Message key={warning}>{warning}</Message>)}
      {!analysis && !busy && <Message>Complete la base de comparación y pulse “Aplicar filtros”.</Message>}
      {analysis && tab === "Dashboard" && <DashboardView analysis={analysis} currency={currency} />}
      {analysis && tab === "Variaciones" && <VariationsView analysis={analysis} currency={currency} />}
      {analysis && tab === "Relevancia de costos" && <RelevanceView analysis={analysis} currency={currency} />}
    </>}
  </div>;
}

function DashboardView({ analysis, currency }: { analysis: Phase9Analysis; currency: string }) {
  const summary = analysis.dashboard.selected_comparison;
  return <div className="page-stack">
    <section className="phase9-kpi-grid">
      <KpiCard label="Base presupuestal" value={money(summary.base_value, currency)} icon={WalletCards} />
      <KpiCard label="Valor comparado" value={money(summary.comparison_value, currency)} icon={BarChart3} />
      <KpiCard label="Variación" value={money(summary.monetary_variation, currency)} detail={percent(summary.percentage_variation)} icon={summary.monetary_variation > 0 ? TrendingUp : TrendingDown} tone={summary.monetary_variation > 0 ? "warning" : "success"} />
      <KpiCard label="Ejecución" value={percent(summary.execution_percentage)} detail={`${summary.rows_with_comparison}/${summary.rows} partidas`} icon={Gauge} />
      <KpiCard label="Centros críticos" value={String(analysis.dashboard.critical_centers.filter((item) => item.unfavorable_impact > 0).length)} detail="Con impacto desfavorable" icon={Target} tone="warning" />
      <KpiCard label="Cobertura real" value={percent(summary.coverage_percentage)} detail={`${summary.unfavorable_count} desviaciones desfavorables`} icon={Scale} />
    </section>
    <ScenarioCards scenarios={analysis.dashboard.scenarios} currency={currency} />
    <section className="grid-2 phase9-dashboard-grid"><article className="panel"><div className="panel__heading"><div><span className="eyebrow">Tendencia mensual</span><h2>{analysis.context.base_label} y {analysis.context.comparison_label}</h2></div><TrendingUp size={22} /></div><LineTrendChart rows={analysis.dashboard.trend} baseLabel={analysis.context.base_label} comparisonLabel={analysis.context.comparison_label} currency={currency} /></article><article className="panel"><div className="panel__heading"><div><span className="eyebrow">Participación</span><h2>Estructura de costos</h2></div><BarChart3 size={22} /></div><ParticipationBars rows={analysis.dashboard.cost_participation} currency={currency} /></article></section>
    <section className="grid-2"><RankingPanel title="Ranking de centros críticos" rows={analysis.dashboard.critical_centers} currency={currency} /><RankingPanel title="Ranking de cuentas" rows={analysis.dashboard.critical_accounts} currency={currency} /></section>
  </div>;
}

function VariationsView({ analysis, currency }: { analysis: Phase9Analysis; currency: string }) {
  const s = analysis.variations.summary;
  return <div className="page-stack">
    <section className="phase9-kpi-grid phase9-kpi-grid--compact"><KpiCard label="Variación monetaria" value={money(s.monetary_variation, currency)} icon={Scale} /><KpiCard label="Variación porcentual" value={percent(s.percentage_variation)} icon={TrendingUp} /><KpiCard label="Ejecución" value={percent(s.execution_percentage)} icon={Gauge} /><KpiCard label="Partidas materiales" value={String(s.material_count)} detail={`Umbral ${analysis.context.materiality_threshold} %`} icon={Target} /></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Trazabilidad completa</span><h2>Detalle de desviaciones</h2></div><span className="status-pill">{analysis.variations.rows.length} filas</span></div><DataTable headers={["Periodo", "Tipo", "Centro", "Grupo / elemento", "Cuenta", analysis.context.base_label, analysis.context.comparison_label, "Variación", "Var. %", "Ejecución", "Participación", "Estado"]} rows={analysis.variations.rows.map((row) => [
      `${row.period_number} · ${row.period_name}`, row.budget_type.replaceAll("_", " "), `${row.center_code} · ${row.center_name}`, <span key="hierarchy"><strong>{row.group_code}</strong><br />{row.element_code} · {row.element_name}</span>, `${row.account_code} · ${row.account_name}`, money(row.base_value, currency), row.comparison_value === null ? "Sin dato" : money(row.comparison_value, currency), row.monetary_variation === null ? "—" : money(row.monetary_variation, currency), percent(row.percentage_variation), percent(row.execution_percentage), percent(row.participation_percentage), <StatusBadge key="status" status={row.status} material={row.material} />,
    ])} empty="No existen variaciones para los filtros seleccionados." /></section>
    <section className="grid-2"><RankingPanel title="Desviación por centro" rows={analysis.variations.centers} currency={currency} /><RankingPanel title="Desviación por elemento" rows={analysis.variations.elements} currency={currency} /></section>
  </div>;
}

function RelevanceView({ analysis, currency }: { analysis: Phase9Analysis; currency: string }) {
  const summary = analysis.relevance.summary;
  return <div className="page-stack">
    <section className="phase9-kpi-grid phase9-kpi-grid--compact"><KpiCard label="Costos base" value={money(summary.base_value, currency)} icon={WalletCards} /><KpiCard label="Costos comparados" value={money(summary.comparison_value, currency)} icon={BarChart3} /><KpiCard label="Impacto en resultado" value={money(summary.result_impact, currency)} detail={summary.result_impact >= 0 ? "Mejora estimada" : "Reducción estimada"} icon={summary.result_impact >= 0 ? TrendingUp : TrendingDown} tone={summary.result_impact >= 0 ? "success" : "warning"} /><KpiCard label="Impacto en rentabilidad" value={percent(summary.profitability_impact)} detail={`${summary.material_items} cuentas materiales`} icon={Gauge} /></section>
    <section className="grid-2"><RelevancePanel title="Costos fijos y variables" rows={analysis.relevance.behavior} currency={currency} /><RelevancePanel title="Costos directos e indirectos" rows={analysis.relevance.traceability} currency={currency} /></section>
    <section className="grid-2"><RelevancePanel title="Centros con mayor impacto" rows={analysis.relevance.centers} currency={currency} /><RelevancePanel title="Elementos relevantes" rows={analysis.relevance.elements} currency={currency} /></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Materialidad e impacto</span><h2>Cuentas relevantes</h2></div><Target size={22} /></div><DataTable headers={["Cuenta", "Base", "Comparación", "Variación", "Participación", "Impacto en resultado", "Impacto rentabilidad", "Clasificación"]} rows={analysis.relevance.accounts.map((row) => [
      `${row.code} · ${row.name}`, money(row.base_value, currency), money(row.comparison_value, currency), money(row.monetary_variation, currency), percent(row.participation_percentage), money(row.result_impact, currency), percent(row.profitability_impact), <StatusBadge key="status" status={row.status} material={row.material} />,
    ])} empty="No hay costos del presupuesto maestro dentro del filtro." /></section>
  </div>;
}

function ScenarioCards({ scenarios, currency }: { scenarios: { original: ScenarioKpis; real: ScenarioKpis; forecast: ScenarioKpis }; currency: string }) {
  return <section className="phase9-scenarios">{(["original", "real", "forecast"] as const).map((key) => <article className="panel phase9-scenario" key={key}><span className="eyebrow">{key === "original" ? "Presupuesto original" : key === "real" ? "Información real" : "Forecast"}</span><h3>{scenarios[key].available ? money(scenarios[key].result, currency) : "No disponible"}</h3><span className="muted">Resultado · rentabilidad {percent(scenarios[key].profitability)}</span><dl><div><dt>Ventas</dt><dd>{money(scenarios[key].sales, currency)}</dd></div><div><dt>Costos</dt><dd>{money(scenarios[key].costs, currency)}</dd></div><div><dt>Gastos</dt><dd>{money(scenarios[key].expenses, currency)}</dd></div></dl></article>)}</section>;
}

function KpiCard({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: string; detail?: string; icon: typeof Gauge; tone?: "default" | "success" | "warning" }) {
  return <article className={`phase9-kpi phase9-kpi--${tone}`}><span className="phase9-kpi__icon"><Icon size={21} /></span><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></article>;
}

function RankingPanel({ title, rows, currency }: { title: string; rows: AggregatedRow[]; currency: string }) {
  return <article className="panel"><div className="panel__heading"><div><span className="eyebrow">Impacto absoluto y desfavorable</span><h2>{title}</h2></div><Target size={21} /></div><div className="phase9-ranking">{rows.slice(0, 8).map((row, index) => <div className="phase9-ranking__row" key={String(row.id)}><span className="phase9-ranking__position">{index + 1}</span><div><strong>{row.code} · {row.name}</strong><span>{percent(row.variance_impact_percentage)} del impacto · {row.material ? "material" : "no material"}</span></div><b>{money(row.monetary_variation, currency)}</b></div>)}{!rows.length && <p className="muted">Sin información para el ranking.</p>}</div></article>;
}

function RelevancePanel({ title, rows, currency }: { title: string; rows: AggregatedRow[]; currency: string }) {
  return <article className="panel"><div className="panel__heading"><div><span className="eyebrow">Participación e impacto</span><h2>{title}</h2></div><BarChart3 size={21} /></div><ParticipationBars rows={rows} currency={currency} /></article>;
}

function ParticipationBars({ rows, currency }: { rows: AggregatedRow[]; currency: string }) {
  return <div className="phase9-participation">{rows.slice(0, 8).map((row) => <div key={String(row.id)}><div className="phase9-participation__label"><span><strong>{row.code}</strong> · {row.name}</span><b>{percent(row.participation_percentage)}</b></div><div className="phase9-participation__track"><span style={{ width: `${Math.min(100, Math.max(0, row.participation_percentage))}%` }} /></div><small>{money(row.base_value, currency)} · impacto {money(row.result_impact, currency)}</small></div>)}{!rows.length && <p className="muted">No existe estructura de costos para mostrar.</p>}</div>;
}

function LineTrendChart({ rows, baseLabel, comparisonLabel, currency }: { rows: TrendRow[]; baseLabel: string; comparisonLabel: string; currency: string }) {
  const active = rows.filter((row) => row.has_data);
  if (!active.length) return <p className="muted">No existe tendencia mensual para los filtros seleccionados.</p>;
  const values = active.flatMap((row) => [row.base_value, row.comparison_value]);
  const min = Math.min(0, ...values); const max = Math.max(1, ...values); const range = max - min || 1;
  const width = 760; const height = 250; const padX = 46; const padY = 25;
  const point = (value: number, index: number) => ({ x: padX + index * ((width - padX * 2) / Math.max(1, active.length - 1)), y: padY + (max - value) / range * (height - padY * 2) });
  const path = (selector: (row: TrendRow) => number) => active.map((row, index) => { const p = point(selector(row), index); return `${index ? "L" : "M"}${p.x},${p.y}`; }).join(" ");
  return <div className="phase9-line-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Tendencia de ${baseLabel} y ${comparisonLabel}`}><line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} className="chart-axis" /><path d={path((row) => row.base_value)} className="chart-line chart-line--base" /><path d={path((row) => row.comparison_value)} className="chart-line chart-line--comparison" />{active.map((row, index) => { const base = point(row.base_value, index); const compared = point(row.comparison_value, index); return <g key={row.period_number}><circle cx={base.x} cy={base.y} r="4" className="chart-dot chart-dot--base" /><circle cx={compared.x} cy={compared.y} r="4" className="chart-dot chart-dot--comparison" /><text x={base.x} y={height - 7} textAnchor="middle">{row.period_number}</text></g>; })}</svg><div className="phase9-chart-legend"><span><i className="legend-base" />{baseLabel}</span><span><i className="legend-comparison" />{comparisonLabel}</span><b>Máximo: {money(max, currency)}</b></div></div>;
}

function StatusBadge({ status, material }: { status: VarianceStatus; material: boolean }) {
  return <span className={`phase9-status phase9-status--${status.toLowerCase()}`}>{status.replaceAll("_", " ")}{material ? " · MATERIAL" : ""}</span>;
}

function money(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try { return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(2)} %`;
}
