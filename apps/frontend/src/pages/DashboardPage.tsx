import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Database, HardDrive, Server, WifiOff } from "lucide-react";
import { apiRequest, API_BASE_URL } from "../lib/api";

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  database: string;
}

interface DemoSummary {
  empresas: number;
  ejercicios: number;
  versiones: number;
  periodos: number;
  mensaje: string;
}

export function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<HealthResponse>("/api/health"),
      apiRequest<DemoSummary>("/api/demo/summary"),
    ])
      .then(([healthResult, summaryResult]) => {
        setHealth(healthResult);
        setSummary(summaryResult);
        setError("");
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "No fue posible conectar con la API local.");
      });
  }, []);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Fase 1 · Base tecnológica</span>
          <h1>Panel de inicio</h1>
          <p>La estructura técnica está preparada para crecer por fases sin mezclar la lógica presupuestal futura.</p>
        </div>
        <span className={`status-pill ${error ? "status-pill--danger" : "status-pill--success"}`}>
          {error ? <WifiOff size={16} /> : <CheckCircle2 size={16} />}
          {error ? "API no disponible" : "Servicios locales activos"}
        </span>
      </section>

      {error && <div className="alert alert--danger"><strong>No se pudo consultar la API local.</strong><span>{error}</span></div>}

      <section className="metric-grid">
        <MetricCard label="Empresas demo" value={summary?.empresas ?? 0} icon={HardDrive} />
        <MetricCard label="Ejercicios" value={summary?.ejercicios ?? 0} icon={Activity} />
        <MetricCard label="Versiones" value={summary?.versiones ?? 0} icon={Database} />
        <MetricCard label="Periodos" value={summary?.periodos ?? 0} icon={Server} />
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Estado técnico</span>
              <h2>Comunicación frontend–backend</h2>
            </div>
            <Server size={22} />
          </div>
          <dl className="detail-list">
            <div><dt>API local</dt><dd>{API_BASE_URL}</dd></div>
            <div><dt>Servicio</dt><dd>{health?.service ?? "Consultando..."}</dd></div>
            <div><dt>Versión</dt><dd>{health?.version ?? "—"}</dd></div>
            <div><dt>SQLite</dt><dd>{health?.database ?? "Consultando..."}</dd></div>
          </dl>
        </article>

        <article className="panel panel--accent">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Alcance actual</span>
              <h2>Qué contiene esta fase</h2>
            </div>
            <Database size={22} />
          </div>
          <ul className="check-list">
            <li>Aplicación React y navegación base.</li>
            <li>API REST local con validación y manejo de errores.</li>
            <li>SQLite con migraciones y datos demo mínimos.</li>
            <li>Electron, logs, respaldo y restauración básica.</li>
            <li>Workflow para generar el ejecutable de Windows.</li>
          </ul>
        </article>
      </section>

      <section className="panel">
        <div className="panel__heading">
          <div>
            <span className="eyebrow">Próximas fases</span>
            <h2>Módulos preparados</h2>
          </div>
        </div>
        <div className="module-preview-grid">
          {["Empresas y sedes", "Estructura presupuestal", "Versiones y escenarios", "Importación flexible", "Presupuesto maestro", "Forecast y control"].map((item) => (
            <div className="module-preview" key={item}>
              <span className="module-preview__dot" />
              <strong>{item}</strong>
              <small>Base de navegación disponible</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Database }) {
  return (
    <article className="metric-card">
      <span className="metric-card__icon"><Icon size={22} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
