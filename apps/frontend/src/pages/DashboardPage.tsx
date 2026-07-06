import { useEffect, useState } from "react";
import { Building2, CalendarDays, CheckCircle2, Database, FileClock, FileSpreadsheet, Server, TrendingUp, WifiOff } from "lucide-react";
import { apiRequest, API_BASE_URL } from "../lib/api";
import { useWorkspace } from "../context/WorkspaceContext";

interface HealthResponse { status: string; service: string; version: string; phase: number; timestamp: string; database: string; accessMode: string; }
interface DemoSummary {
  empresas: number; responsables: number; centros: number; cuentas: number; ejercicios: number; versiones: number; periodos: number;
  importaciones: number; lineas_presupuesto_original: number; productos_materiales: number; lineas_ventas: number;
  lineas_inventarios: number; lineas_compras: number; lineas_costos: number; lineas_gastos: number; lineas_inversiones: number;
  datos_reales: number; versiones_forecast: number; lineas_forecast: number; mensaje: string;
}

export function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [error, setError] = useState("");
  const { company, exercise, period, version } = useWorkspace();

  useEffect(() => {
    Promise.all([apiRequest<HealthResponse>("/api/health"), apiRequest<DemoSummary>("/api/demo/summary")])
      .then(([healthResult, summaryResult]) => { setHealth(healthResult); setSummary(summaryResult); setError(""); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible conectar con la API local."));
  }, [company?.id, exercise?.id, version?.id]);

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 7 · Información real y forecast</span><h1>Panel de inicio</h1><p>La aplicación combina presupuesto original, ejecución real documentada y múltiples revisiones forecast por mes de corte.</p></div><span className={`status-pill ${error ? "status-pill--danger" : "status-pill--success"}`}>{error ? <WifiOff size={16} /> : <CheckCircle2 size={16} />}{error ? "API no disponible" : "Servicios locales activos"}</span></section>
    {error && <div className="alert alert--danger"><strong>No se pudo consultar la API local.</strong><span>{error}</span></div>}
    <section className="metric-grid"><MetricCard label="Empresas" value={summary?.empresas ?? 0} icon={Building2} /><MetricCard label="Ejercicios" value={summary?.ejercicios ?? 0} icon={CalendarDays} /><MetricCard label="Datos reales" value={summary?.datos_reales ?? 0} icon={Database} /><MetricCard label="Versiones forecast" value={summary?.versiones_forecast ?? 0} icon={TrendingUp} /></section>
    <section className="grid-2"><article className="panel"><div className="panel__heading"><div><span className="eyebrow">Estado técnico</span><h2>Comunicación local</h2></div><Server size={22} /></div><dl className="detail-list"><div><dt>API local</dt><dd>{API_BASE_URL}</dd></div><div><dt>Servicio</dt><dd>{health?.service ?? "Consultando..."}</dd></div><div><dt>Versión</dt><dd>{health?.version ?? "—"}</dd></div><div><dt>Fase</dt><dd>{health?.phase ?? "—"}</dd></div><div><dt>SQLite</dt><dd>{health?.database ?? "Consultando..."}</dd></div><div><dt>Acceso</dt><dd>Directo, sin login</dd></div></dl></article><article className="panel panel--accent"><div className="panel__heading"><div><span className="eyebrow">Alcance actual</span><h2>Qué contiene la Fase 7</h2></div><FileSpreadsheet size={22} /></div><ul className="check-list"><li>Registro manual e importación Excel de información real.</li><li>Fuente, periodo, fecha, responsable y clasificación del dato.</li><li>Forecast vinculado a un presupuesto original aprobado.</li><li>Meses reales protegidos hasta el corte.</li><li>Proyección editable para los meses posteriores.</li><li>Múltiples revisiones forecast, aprobación y bloqueo.</li></ul></article></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Contexto activo</span><h2>{company?.commercial_name ?? "Seleccione una empresa"}</h2></div><Database size={22} /></div><dl className="detail-list"><div><dt>Ejercicio</dt><dd>{exercise ? `${exercise.code} · ${exercise.budget_year}` : "Sin seleccionar"}</dd></div><div><dt>Periodo</dt><dd>{period ? `${period.period_number}. ${period.name} · ${period.status}` : "Sin seleccionar"}</dd></div><div><dt>Versión</dt><dd>{version ? `${version.code} · ${version.version_type} · ${version.status}` : "Sin seleccionar"}</dd></div></dl><p className="muted">El análisis financiero integral, las variaciones avanzadas, la relevancia de costos y el dashboard ejecutivo se implementarán en fases posteriores.</p></section>
  </div>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Database }) {
  return <article className="metric-card"><span className="metric-card__icon"><Icon size={22} /></span><div><span>{label}</span><strong>{value}</strong></div></article>;
}
