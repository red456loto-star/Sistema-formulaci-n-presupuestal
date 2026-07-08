import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { DataTable, Field, FormGrid, Message } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import type { Phase10Options, ReportDocument, ReportType } from "./types";
import { downloadPhase10, formatReportValue } from "./utils";

const reportLabels: Record<ReportType, string> = {
  ORIGINAL: "Presupuesto original",
  FORECAST: "Forecast",
  MASTER: "Presupuesto maestro",
  FINANCIAL: "Estados financieros",
  VARIANCES: "Variaciones",
  CENTERS: "Centros de actividad",
  EXECUTIVE: "Resumen ejecutivo",
  DASHBOARD: "Dashboard",
  PROPOSALS: "Propuestas de mejora",
};

const reportDescriptions: Record<ReportType, string> = {
  ORIGINAL: "Presupuesto anual mensualizado con trazabilidad hasta la cuenta.",
  FORECAST: "Valores reales al corte, proyección y comparación con el original.",
  MASTER: "Integración mensual de ventas, costos, gastos, inversiones y estados.",
  FINANCIAL: "Estados financieros, ratios, Dupont y EVA.",
  VARIANCES: "Desviaciones monetarias, porcentuales, ejecución y materialidad.",
  CENTERS: "Participación, responsable y desviación por centro de actividad.",
  EXECUTIVE: "Indicadores principales para distribución ejecutiva.",
  DASHBOARD: "Indicadores, tendencia y centros críticos del dashboard.",
  PROPOSALS: "Problemas, evidencia, acciones, impacto, prioridad y plazo.",
};

const EMPTY_OPTIONS: Phase10Options = { versions: [], approved_versions: [], centers: [], responsibles: [] };

export function ReportsPage() {
  const { companyId, exerciseId, versionId, period } = useWorkspace();
  const [options, setOptions] = useState<Phase10Options>(EMPTY_OPTIONS);
  const [reportType, setReportType] = useState<ReportType>("EXECUTIVE");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [periodNumber, setPeriodNumber] = useState("");
  const [centerId, setCenterId] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [preview, setPreview] = useState<ReportDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setPeriodNumber(period ? String(period.period_number) : ""), [period?.id]);
  useEffect(() => {
    if (!companyId || !exerciseId) {
      setOptions(EMPTY_OPTIONS); setSelectedVersion(""); setPreview(null); return;
    }
    setBusy(true); setError("");
    apiRequest<Phase10Options>(`/api/phase10/options?company_id=${companyId}&exercise_id=${exerciseId}`)
      .then((result) => {
        setOptions(result);
        const selected = result.versions.find((item) => item.id === versionId) ?? result.versions[0];
        setSelectedVersion(selected ? String(selected.id) : "");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar los filtros de reportes."))
      .finally(() => setBusy(false));
  }, [companyId, exerciseId, versionId]);

  useEffect(() => {
    const current = options.versions.find((item) => item.id === Number(selectedVersion));
    if (reportType === "ORIGINAL" || reportType === "MASTER") {
      if (current?.version_type !== "ORIGINAL") setSelectedVersion(options.versions.find((item) => item.version_type === "ORIGINAL")?.id.toString() ?? "");
    }
    if (reportType === "FORECAST" && current?.version_type !== "FORECAST") {
      setSelectedVersion(options.versions.find((item) => item.version_type === "FORECAST")?.id.toString() ?? "");
    }
    setPreview(null);
  }, [reportType, options.versions]);

  const selectedCenter = useMemo(() => options.centers.find((item) => item.id === Number(centerId)), [options.centers, centerId]);
  useEffect(() => {
    if (selectedCenter) setResponsibleId(String(selectedCenter.responsible_id));
  }, [selectedCenter?.id]);

  const body = () => {
    if (!companyId || !exerciseId || !selectedVersion) throw new Error("Seleccione empresa, ejercicio y versión.");
    return {
      company_id: companyId,
      exercise_id: exerciseId,
      version_id: Number(selectedVersion),
      report_type: reportType,
      period_number: periodNumber ? Number(periodNumber) : null,
      center_id: centerId ? Number(centerId) : null,
      responsible_id: responsibleId ? Number(responsibleId) : null,
    };
  };

  const generatePreview = async () => {
    setBusy(true); setError("");
    try { setPreview(await apiRequest<ReportDocument>("/api/phase10/reports/preview", { method: "POST", body: JSON.stringify(body()) })); }
    catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : "No fue posible generar el reporte."); }
    finally { setBusy(false); }
  };

  const exportFile = async (type: "excel" | "pdf") => {
    setBusy(true); setError("");
    try { await downloadPhase10(`/api/phase10/reports/${type}`, body(), `reporte.${type === "excel" ? "xlsx" : "pdf"}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible exportar el reporte."); }
    finally { setBusy(false); }
  };

  return <div className="page-stack phase10-page">
    <section className="page-heading">
      <div><span className="eyebrow">Fase 10 · Distribución de información</span><h1>Reportes empresariales</h1><p>Consulte, imprima y exporte reportes respetando empresa, ejercicio, periodo, versión, centro y responsable.</p></div>
      <div className="button-row"><button className="button button--ghost" disabled={!preview} onClick={() => window.print()}><Printer size={16} />Imprimir</button><button className="button button--ghost" disabled={busy || !selectedVersion} onClick={() => void exportFile("excel")}><Download size={16} />Excel</button><button className="button button--primary" disabled={busy || !selectedVersion} onClick={() => void exportFile("pdf")}><FileText size={16} />PDF</button></div>
    </section>

    {error && <Message type="danger">{error}</Message>}
    {!companyId || !exerciseId ? <Message>Seleccione una empresa y un ejercicio en la barra superior.</Message> : <>
      <section className="panel phase10-no-print">
        <div className="panel__heading"><div><span className="eyebrow">Filtros del reporte</span><h2>{reportLabels[reportType]}</h2><p className="muted">{reportDescriptions[reportType]}</p></div><FileText size={22} /></div>
        <FormGrid>
          <Field label="Reporte"><select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}>{Object.entries(reportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Versión"><select value={selectedVersion} onChange={(event) => { setSelectedVersion(event.target.value); setPreview(null); }}><option value="">Seleccione</option>{options.versions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.version_type} · {item.status}</option>)}</select></Field>
          <Field label="Periodo"><select value={periodNumber} onChange={(event) => { setPeriodNumber(event.target.value); setPreview(null); }}><option value="">Total anual</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, "0")}</option>)}</select></Field>
          <Field label="Centro"><select value={centerId} onChange={(event) => { setCenterId(event.target.value); setPreview(null); }}><option value="">Todos los centros</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Responsable"><select value={responsibleId} onChange={(event) => { setResponsibleId(event.target.value); setPreview(null); }}><option value="">Todos los responsables</option>{options.responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field>
        </FormGrid>
        <div className="phase10-actions"><span className="muted">La vista previa utiliza los mismos datos que Excel, PDF e impresión.</span><button className="button button--primary" disabled={busy || !selectedVersion} onClick={() => void generatePreview()}><RefreshCw size={16} />{busy ? "Generando..." : "Generar vista previa"}</button></div>
      </section>

      {!preview && !busy && <Message>Seleccione los filtros y genere la vista previa.</Message>}
      {preview && <section className="phase10-print-area">
        <article className="panel phase10-report-header"><span className="eyebrow">{preview.context.company_name}</span><h2>{preview.title}</h2><p>{preview.subtitle}</p><div className="phase10-report-context"><span><strong>Ejercicio:</strong> {preview.context.exercise_code} · {preview.context.budget_year}</span><span><strong>Versión:</strong> {preview.context.version_code} · {preview.context.version_status}</span><span><strong>Periodo:</strong> {preview.context.period_label}</span><span><strong>Centro:</strong> {preview.context.center_label}</span><span><strong>Responsable:</strong> {preview.context.responsible_label}</span></div></article>
        <section className="phase10-summary-grid">{preview.summary.map((item) => <article key={item.label} className="phase10-summary-card"><span>{item.label}</span><strong>{formatReportValue(item.value, item.type, preview.context.currency_code)}</strong></article>)}</section>
        {preview.notes.map((note) => <Message key={note}>{note}</Message>)}
        <article className="panel phase10-report-table"><div className="panel__heading"><div><span className="eyebrow">Consulta en pantalla</span><h2>Detalle del reporte</h2></div><span className="status-pill">{preview.rows.length} registros</span></div><DataTable headers={preview.columns.map((column) => column.label)} rows={preview.rows.map((row) => preview.columns.map((column) => formatReportValue(row[column.key], column.type, preview.context.currency_code)))} empty="No existen datos para los filtros seleccionados." /></article>
      </section>}
    </>}
  </div>;
}
