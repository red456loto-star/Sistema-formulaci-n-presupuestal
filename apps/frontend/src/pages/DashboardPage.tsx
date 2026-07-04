
import { useEffect, useState } from "react";
import { Activity, Building2, CheckCircle2, Database, Server, UserRoundCog, WalletCards, WifiOff } from "lucide-react";
import { apiRequest, API_BASE_URL } from "../lib/api";
import { useWorkspace } from "../context/WorkspaceContext";

interface HealthResponse { status: string; service: string; version: string; phase: number; timestamp: string; database: string; accessMode: string; }
interface DemoSummary { empresas: number; responsables: number; centros: number; cuentas: number; ejercicios: number; versiones: number; periodos: number; mensaje: string; }

export function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [error, setError] = useState("");
  const { company } = useWorkspace();

  useEffect(() => {
    Promise.all([apiRequest<HealthResponse>("/api/health"), apiRequest<DemoSummary>("/api/demo/summary")])
      .then(([healthResult, summaryResult]) => { setHealth(healthResult); setSummary(summaryResult); setError(""); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible conectar con la API local."));
  }, [company?.id]);

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 2 · Empresas y estructura</span><h1>Panel de inicio</h1><p>La aplicación se abre directamente, sin cuentas, contraseñas, usuarios, roles ni permisos.</p></div><span className={`status-pill ${error ? "status-pill--danger" : "status-pill--success"}`}>{error ? <WifiOff size={16} /> : <CheckCircle2 size={16} />}{error ? "API no disponible" : "Servicios locales activos"}</span></section>
    {error && <div className="alert alert--danger"><strong>No se pudo consultar la API local.</strong><span>{error}</span></div>}
    <section className="metric-grid"><MetricCard label="Empresas" value={summary?.empresas ?? 0} icon={Building2} /><MetricCard label="Responsables" value={summary?.responsables ?? 0} icon={UserRoundCog} /><MetricCard label="Centros" value={summary?.centros ?? 0} icon={Activity} /><MetricCard label="Cuentas" value={summary?.cuentas ?? 0} icon={WalletCards} /></section>
    <section className="grid-2"><article className="panel"><div className="panel__heading"><div><span className="eyebrow">Estado técnico</span><h2>Comunicación local</h2></div><Server size={22} /></div><dl className="detail-list"><div><dt>API local</dt><dd>{API_BASE_URL}</dd></div><div><dt>Servicio</dt><dd>{health?.service ?? "Consultando..."}</dd></div><div><dt>Versión</dt><dd>{health?.version ?? "—"}</dd></div><div><dt>SQLite</dt><dd>{health?.database ?? "Consultando..."}</dd></div><div><dt>Acceso</dt><dd>Directo, sin login</dd></div></dl></article><article className="panel panel--accent"><div className="panel__heading"><div><span className="eyebrow">Alcance actual</span><h2>Qué contiene la Fase 2</h2></div><Database size={22} /></div><ul className="check-list"><li>Empresas, sedes, responsables y centros.</li><li>Grupos, elementos y cuentas presupuestales.</li><li>Jerarquía integral por empresa.</li><li>Monedas, tipos de cambio y unidades.</li><li>Persistencia local con SQLite.</li><li>Acceso inmediato al abrir el ejecutable.</li></ul></article></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Contexto activo</span><h2>{company?.commercial_name ?? "Seleccione una empresa"}</h2></div><Database size={22} /></div><p className="muted">En fases posteriores, cada línea presupuestal se relacionará con empresa, centro de actividad, cuenta, ejercicio, periodo y versión.</p></section>
  </div>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Database }) {
  return <article className="metric-card"><span className="metric-card__icon"><Icon size={22} /></span><div><span>{label}</span><strong>{value}</strong></div></article>;
}
