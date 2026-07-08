import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileText, Printer, RefreshCw, Scale, Target, TrendingUp } from "lucide-react";
import { DataTable, Message, Tabs } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import { downloadPhase10, formatReportValue } from "../phase10/utils";
import type { Phase11Analysis } from "./types";

export type AnalysisMode = "FINANCIAL" | "COSTS" | "VARIATIONS" | "DASHBOARD";

const titles: Record<AnalysisMode, { eyebrow: string; title: string; description: string }> = {
  FINANCIAL: {
    eyebrow: "Paso 5 · Cálculo automático",
    title: "Análisis integral de estados financieros",
    description: "Análisis vertical, horizontal, ratios, Dupont y EVA calculados directamente desde las tablas maestras.",
  },
  COSTS: {
    eyebrow: "Paso 5 · Cálculo automático",
    title: "Relevancia de la estructura de costos",
    description: "Analiza costos fijos, variables, directos e indirectos y su participación por centro y elemento.",
  },
  VARIATIONS: {
    eyebrow: "Paso 6 · Control presupuestal",
    title: "Análisis de variaciones",
    description: "Compara la data presupuestada con la data real por periodo, tipo de presupuesto, centro, elemento y cuenta.",
  },
  DASHBOARD: {
    eyebrow: "Paso 6 · Presentación gerencial",
    title: "Dashboard de presupuestos",
    description: "Resume ejecución, tendencia, rentabilidad y partidas críticas del contexto activo.",
  },
};

const icons = { FINANCIAL: BarChart3, COSTS: Target, VARIATIONS: Scale, DASHBOARD: TrendingUp };

function contextParams(values: { companyId: number; exerciseId: number; periodId: number; versionId: number; budgetTypeId: number }) {
  return `company_id=${values.companyId}&exercise_id=${values.exerciseId}&period_id=${values.periodId}&version_id=${values.versionId}&budget_type_id=${values.budgetTypeId}`;
}

export function AnalysisWorkspacePage({ mode }: { mode: AnalysisMode }) {
  const { companyId, exerciseId, periodId, versionId, budgetTypeId, workflowStatus } = useWorkspace();
  const [analysis, setAnalysis] = useState<Phase11Analysis | null>(null);
  const [financialTab, setFinancialTab] = useState("Análisis vertical");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = Boolean(companyId && exerciseId && periodId && versionId && budgetTypeId && workflowStatus?.master_data_ready);
  const Icon = icons[mode];

  const context = useMemo(() => ready ? {
    companyId: companyId!, exerciseId: exerciseId!, periodId: periodId!, versionId: versionId!, budgetTypeId: budgetTypeId!,
  } : null, [ready, companyId, exerciseId, periodId, versionId, budgetTypeId]);

  const load = async () => {
    if (!context) { setAnalysis(null); return; }
    setBusy(true); setError("");
    try { setAnalysis(await apiRequest<Phase11Analysis>(`/api/phase11/analysis?${contextParams(context)}`)); }
    catch (reason) { setAnalysis(null); setError(reason instanceof Error ? reason.message : "No fue posible calcular el análisis."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [companyId, exerciseId, periodId, versionId, budgetTypeId, workflowStatus?.counts?.budgeted_rows, workflowStatus?.counts?.real_rows]);

  const report = async (format: "excel" | "pdf") => {
    if (!context) return;
    setBusy(true); setError("");
    try {
      await downloadPhase10(`/api/phase11/reports/${format}`, {
        company_id: context.companyId, exercise_id: context.exerciseId, period_id: context.periodId,
        version_id: context.versionId, budget_type_id: context.budgetTypeId, kind: mode,
      }, `${mode.toLowerCase()}.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible generar el reporte."); }
    finally { setBusy(false); }
  };

  const currency = "PEN";
  const summary = mode === "DASHBOARD" ? analysis?.dashboard.summary : mode === "VARIATIONS" ? analysis?.variations.summary : null;

  return <div className="page-stack phase11-page phase11-analysis-page">
    <section className="page-heading phase11-no-print">
      <div><span className="eyebrow">{titles[mode].eyebrow}</span><h1>{titles[mode].title}</h1><p>{titles[mode].description}</p></div>
      <div className="button-row"><button className="button button--ghost" disabled={busy || !analysis} onClick={() => window.print()}><Printer size={16} />Imprimir</button><button className="button button--ghost" disabled={busy || !analysis} onClick={() => void report("excel")}><Download size={16} />Excel</button><button className="button button--primary" disabled={busy || !analysis} onClick={() => void report("pdf")}><FileText size={16} />PDF</button></div>
    </section>
    {!ready && <Message type="danger">Primero registre información en “Tablas maestras” para la empresa, periodo, versión y tipo de presupuesto activos.</Message>}
    {error && <Message type="danger">{error}</Message>}
    {ready && !analysis && !busy && <Message>No se pudo obtener un análisis para el contexto seleccionado.</Message>}
    {busy && !analysis && <Message>Calculando información...</Message>}
    {analysis && <div className="phase11-print-area">
      <section className="panel phase11-report-context"><div><Icon size={24} /><div><span className="eyebrow">{analysis.context.company_name}</span><h2>{titles[mode].title}</h2><p>{analysis.context.exercise_code} · {analysis.context.period_name} · {analysis.context.version_code} · {analysis.context.budget_type_name}</p></div></div><button className="button button--ghost phase11-no-print" onClick={() => void load()} disabled={busy}><RefreshCw size={15} />Actualizar</button></section>
      {analysis.warnings.map((warning) => <Message key={warning}>{warning}</Message>)}

      {mode === "FINANCIAL" && <FinancialView analysis={analysis} tab={financialTab} setTab={setFinancialTab} currency={currency} />}
      {mode === "COSTS" && <CostView analysis={analysis} currency={currency} />}
      {mode === "VARIATIONS" && <VariationView analysis={analysis} currency={currency} />}
      {mode === "DASHBOARD" && <DashboardView analysis={analysis} currency={currency} />}
      {summary && <span className="sr-only">{JSON.stringify(summary)}</span>}
    </div>}
  </div>;
}

function SummaryCards({ items, currency = "PEN" }: { items: Array<{ label: string; value: unknown; type: "money" | "percent" | "number" }>; currency?: string }) {
  return <section className="phase11-summary-grid">{items.map((item) => <article className="phase11-summary-card" key={item.label}><span>{item.label}</span><strong>{formatReportValue(item.value, item.type, currency)}</strong></article>)}</section>;
}

function FinancialView({ analysis, tab, setTab, currency }: { analysis: Phase11Analysis; tab: string; setTab: (value: string) => void; currency: string }) {
  return <div className="page-stack">
    <SummaryCards currency={currency} items={[
      { label: "Ventas presupuestadas", value: analysis.financial.budgeted.sales, type: "money" },
      { label: "Ventas reales", value: analysis.financial.real.sales, type: "money" },
      { label: "Resultado real", value: analysis.financial.real.net_income, type: "money" },
      { label: "ROE Dupont", value: analysis.financial.dupont.roe, type: "percent" },
      { label: "EVA", value: analysis.financial.eva.eva, type: "money" },
    ]} />
    <Tabs items={["Análisis vertical", "Análisis horizontal", "Ratios", "Dupont", "EVA"]} active={tab} onChange={setTab} />
    {tab === "Análisis vertical" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Composición</span><h2>Participación de cada partida</h2></div></div><DataTable headers={["Origen", "Estado", "Partida", "Importe", "Participación"]} rows={analysis.financial.vertical.map((row) => [row.data_kind, row.statement.replaceAll("_", " "), row.label, formatReportValue(row.amount, "money", currency), formatReportValue(row.vertical_percentage, "percent")])} /></section>}
    {tab === "Análisis horizontal" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Comparación</span><h2>Presupuestado versus real</h2></div></div><DataTable headers={["Partida", "Presupuestado", "Real", "Variación", "Variación %"]} rows={analysis.financial.horizontal.map((row) => [row.label, formatReportValue(row.budgeted, "money", currency), formatReportValue(row.real, "money", currency), formatReportValue(row.variation, "money", currency), formatReportValue(row.variation_percentage, "percent")])} /></section>}
    {tab === "Ratios" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Indicadores</span><h2>Ratios financieros</h2></div></div><DataTable headers={["Ratio", "Resultado", "Fórmula"]} rows={analysis.financial.ratios.map((row) => [row.name, formatReportValue(row.result, row.name.includes("Margen") || row.name.includes("Endeudamiento") || row.name.startsWith("RO") ? "percent" : "number"), row.formula])} /></section>}
    {tab === "Dupont" && <section className="grid-2"><article className="panel"><span className="eyebrow">Descomposición del ROE</span><h2>{formatReportValue(analysis.financial.dupont.roe, "percent")}</h2><p>{analysis.financial.dupont.formula}</p></article><article className="panel"><DataTable headers={["Componente", "Resultado"]} rows={[["Margen neto", formatReportValue(analysis.financial.dupont.net_margin, "percent")],["Rotación de activos", formatReportValue(analysis.financial.dupont.asset_turnover, "number")],["Multiplicador patrimonial", formatReportValue(analysis.financial.dupont.equity_multiplier, "number")]]} /></article></section>}
    {tab === "EVA" && <section className="grid-2"><article className="panel"><span className="eyebrow">Valor económico agregado</span><h2>{formatReportValue(analysis.financial.eva.eva, "money", currency)}</h2><p>{analysis.financial.eva.complete ? "El cálculo utiliza el WACC registrado en Tablas maestras." : "Registre una tasa WACC en Tablas maestras para completar el EVA."}</p></article><article className="panel"><DataTable headers={["Variable", "Valor"]} rows={[["NOPAT", formatReportValue(analysis.financial.eva.nopat, "money", currency)],["Capital invertido", formatReportValue(analysis.financial.eva.invested_capital, "money", currency)],["WACC", formatReportValue(analysis.financial.eva.wacc_rate, "percent")]]} /></article></section>}
  </div>;
}

function CostView({ analysis, currency }: { analysis: Phase11Analysis; currency: string }) {
  const summary = analysis.costs.summary;
  return <div className="page-stack">
    <SummaryCards currency={currency} items={[
      { label: "Costo total", value: summary.total, type: "money" }, { label: "Costos fijos", value: summary.fixed, type: "money" },
      { label: "Costos variables", value: summary.variable, type: "money" }, { label: "Costos directos", value: summary.direct, type: "money" },
      { label: "Costos indirectos", value: summary.indirect, type: "money" }, { label: "Punto de equilibrio", value: summary.break_even_sales, type: "money" },
    ]} />
    <div className="grid-2 grid-2--wide"><section className="panel"><div className="panel__heading"><div><span className="eyebrow">Centros</span><h2>Relevancia por centro</h2></div></div><DataTable headers={["Código", "Centro", "Importe", "Participación"]} rows={analysis.costs.by_center.map((row) => [row.code, row.name, formatReportValue(row.amount, "money", currency), formatReportValue(row.participation, "percent")])} empty="No se identificaron costos por centro." /></section><section className="panel"><div className="panel__heading"><div><span className="eyebrow">Elementos</span><h2>Relevancia por elemento</h2></div></div><DataTable headers={["Código", "Elemento", "Importe", "Participación"]} rows={analysis.costs.by_element.map((row) => [row.code, row.name, formatReportValue(row.amount, "money", currency), formatReportValue(row.participation, "percent")])} empty="No se identificaron costos por elemento." /></section></div>
  </div>;
}

function VariationView({ analysis, currency }: { analysis: Phase11Analysis; currency: string }) {
  return <div className="page-stack">
    <SummaryCards currency={currency} items={[
      { label: "Presupuestado", value: analysis.variations.summary.budgeted, type: "money" }, { label: "Real", value: analysis.variations.summary.real, type: "money" },
      { label: "Variación", value: analysis.variations.summary.variation, type: "money" }, { label: "Ejecución", value: analysis.variations.summary.execution_percentage, type: "percent" },
    ]} />
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Detalle multidimensional</span><h2>Variaciones del periodo</h2></div></div><DataTable headers={["Centro", "Elemento", "Cuenta", "Naturaleza", "Presupuestado", "Real", "Variación", "Variación %", "Ejecución %", "Estado"]} rows={analysis.variations.rows.map((row) => [`${row.center_code ?? "—"} ${row.center_name ?? ""}`, `${row.element_code ?? "—"} ${row.element_name ?? ""}`, `${row.account_code ?? "—"} ${row.account_name ?? ""}`, String(row.account_nature ?? "—"), formatReportValue(row.budgeted, "money", currency), formatReportValue(row.real, "money", currency), formatReportValue(row.variation, "money", currency), formatReportValue(row.variation_percentage, "percent"), formatReportValue(row.execution_percentage, "percent"), <span key="status" className={`phase11-status phase11-status--${String(row.status).toLowerCase()}`}>{String(row.status).replaceAll("_", " ")}</span>])} empty="No existen partidas comparables." /></section>
  </div>;
}

function DashboardView({ analysis, currency }: { analysis: Phase11Analysis; currency: string }) {
  return <div className="page-stack">
    <SummaryCards currency={currency} items={[
      { label: "Presupuestado", value: analysis.dashboard.summary.budgeted, type: "money" }, { label: "Real", value: analysis.dashboard.summary.real, type: "money" },
      { label: "Variación", value: analysis.dashboard.summary.variation, type: "money" }, { label: "Ejecución", value: analysis.dashboard.summary.execution_percentage, type: "percent" },
      { label: "Rentabilidad / resultado", value: analysis.dashboard.profitability, type: "money" }, { label: "Partidas desfavorables", value: analysis.dashboard.summary.unfavorable_items, type: "number" },
    ]} />
    <div className="grid-2 grid-2--wide"><section className="panel"><div className="panel__heading"><div><span className="eyebrow">Evolución</span><h2>Tendencia por periodo</h2></div></div><DataTable headers={["Periodo", "Presupuestado", "Real", "Variación", "Ejecución"]} rows={analysis.dashboard.trend.map((row) => [`${row.period_number} · ${row.period_name}`, formatReportValue(row.budgeted, "money", currency), formatReportValue(row.real, "money", currency), formatReportValue(row.variation, "money", currency), formatReportValue(row.execution_percentage, "percent")])} empty="No existen otros periodos con data maestra." /></section><section className="panel"><div className="panel__heading"><div><span className="eyebrow">Atención gerencial</span><h2>Partidas críticas</h2></div></div><DataTable headers={["Centro", "Cuenta", "Variación", "Variación %"]} rows={analysis.dashboard.critical_items.map((row) => [`${row.center_code ?? "—"} ${row.center_name ?? ""}`, `${row.account_code ?? "—"} ${row.account_name ?? ""}`, formatReportValue(row.variation, "money", currency), formatReportValue(row.variation_percentage, "percent")])} empty="No existen variaciones desfavorables." /></section></div>
  </div>;
}
