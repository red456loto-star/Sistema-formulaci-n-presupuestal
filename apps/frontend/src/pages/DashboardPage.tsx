import { useEffect, useState } from "react";
import { Activity, Building2, CheckCircle2, Database, Server, ShieldCheck, Users, WalletCards, WifiOff } from "lucide-react";
import { apiRequest, API_BASE_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

interface HealthResponse { status: string; service: string; version: string; phase: number; timestamp: string; database: string; }
interface DemoSummary { empresas: number; usuarios: number; centros: number; cuentas: number; ejercicios: number; versiones: number; periodos: number; mensaje: string; }

export function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const { company } = useWorkspace();

  useEffect(() => { Promise.all([apiRequest<HealthResponse>("/api/health"), apiRequest<DemoSummary>("/api/demo/summary")]).then(([healthResult, summaryResult]) => { setHealth(healthResult); setSummary(summaryResult); setError(""); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible conectar con la API local.")); }, [company?.id]);

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 2 · Seguridad y estructura</span><h1>Panel de inicio</h1><p>Bienvenido, {user?.fullName}. La organización, los permisos y la jerarquía presupuestal ya se gestionan desde SQLite.</p></div><span className={`status-pill ${error ? "status-pill--danger" : "status-pill--success"}`}>{error ? <WifiOff size={16} /> : <CheckCircle2 size={16} />}{error ? "API no disponible" : "Servicios locales activos"}</span></section>
    {error && <div className="alert alert--danger"><strong>No se pudo consultar la API local.</strong><span>{error}</span></div>}
    <section className="metric-grid"><MetricCard label="Empresas" value={summary?.empresas ?? 0} icon={Building2} /><MetricCard label="Usuarios" value={summary?.usuarios ?? 0} icon={Users} /><MetricCard label="Centros" value={summary?.centros ?? 0} icon={Activity} /><MetricCard label="Cuentas" value={summary?.cuentas ?? 0} icon={WalletCards} /></section>
    <section className="grid-2"><article className="panel"><div className="panel__heading"><div><span className="eyebrow">Estado técnico</span><h2>Comunicación frontend–backend</h2></div><Server size={22} /></div><dl className="detail-list"><div><dt>API local</dt><dd>{API_BASE_URL}</dd></div><div><dt>Servicio</dt><dd>{health?.service ?? "Consultando..."}</dd></div><div><dt>Versión</dt><dd>{health?.version ?? "—"}</dd></div><div><dt>SQLite</dt><dd>{health?.database ?? "Consultando..."}</dd></div></dl></article><article className="panel panel--accent"><div className="panel__heading"><div><span className="eyebrow">Alcance actual</span><h2>Qué contiene la Fase 2</h2></div><ShieldCheck size={22} /></div><ul className="check-list"><li>Inicio de sesión local y contraseñas protegidas.</li><li>Roles y permisos por módulo y acción.</li><li>Empresas, sedes, responsables y centros.</li><li>Grupos, elementos y cuentas presupuestales.</li><li>Monedas, tipos de cambio y unidades.</li><li>Auditoría de creación, modificación y desactivación.</li></ul></article></section>
    <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Contexto activo</span><h2>{company?.commercial_name ?? "Seleccione una empresa"}</h2></div><Database size={22} /></div><p className="muted">La Fase 2 separa la estructura organizacional de la estructura presupuestal. En fases posteriores, cada línea presupuestal relacionará un centro de actividad con una cuenta, un ejercicio, un periodo y una versión.</p></section>
  </div>;
}
function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Database }) { return <article className="metric-card"><span className="metric-card__icon"><Icon size={22} /></span><div><span>{label}</span><strong>{value}</strong></div></article>; }
