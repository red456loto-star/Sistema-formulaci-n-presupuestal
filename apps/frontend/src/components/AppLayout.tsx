import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  Database,
  FileSpreadsheet,
  Gauge,
  Import,
  LayoutDashboard,
  Lightbulb,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { apiRequest } from "../lib/api";

interface DemoContext {
  empresa: string;
  ejercicio: number;
  periodo: string;
  version: string;
  usuario: string;
}

const navigation = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/empresas", label: "Empresas", icon: BriefcaseBusiness },
  { to: "/estructura", label: "Estructura presupuestal", icon: Target },
  { to: "/periodos", label: "Periodos", icon: CalendarRange },
  { to: "/versiones", label: "Versiones", icon: ShieldCheck },
  { to: "/importacion", label: "Importación", icon: Import },
  { to: "/presupuesto-original", label: "Presupuesto original", icon: FileSpreadsheet },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/presupuesto-maestro", label: "Presupuesto maestro", icon: CircleDollarSign },
  { to: "/estados-financieros", label: "Estados financieros", icon: BarChart3 },
  { to: "/control", label: "Control presupuestal", icon: Gauge },
  { to: "/analisis", label: "Análisis", icon: ChartNoAxesCombined },
  { to: "/reportes", label: "Reportes", icon: FileSpreadsheet },
  { to: "/propuestas", label: "Propuestas", icon: Lightbulb },
  { to: "/estado-sistema", label: "Estado del sistema", icon: Database },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [context, setContext] = useState<DemoContext | null>(null);

  useEffect(() => {
    apiRequest<DemoContext>("/api/demo/context")
      .then(setContext)
      .catch(() => setContext(null));
  }, []);

  const sidebarClass = [
    "sidebar",
    collapsed ? "sidebar--collapsed" : "",
    mobileOpen ? "sidebar--mobile-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="app-shell">
      <aside className={sidebarClass}>
        <div className="brand">
          <div className="brand__mark">PC</div>
          {!collapsed && (
            <div>
              <strong>PresuControl</strong>
              <span>Gestión presupuestal</span>
            </div>
          )}
          <button className="icon-button sidebar__mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav className="navigation" aria-label="Navegación principal">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `navigation__item ${isActive ? "navigation__item--active" : ""}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
            >
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <button className="sidebar__collapse" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Contraer menú</span>}
        </button>
      </aside>

      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}

      <div className={`workspace ${collapsed ? "workspace--expanded" : ""}`}>
        <header className="topbar">
          <button className="icon-button topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu size={21} />
          </button>
          <div className="context-grid">
            <ContextItem label="Empresa" value={context?.empresa ?? "Sin seleccionar"} />
            <ContextItem label="Ejercicio" value={context?.ejercicio ? String(context.ejercicio) : "Pendiente"} />
            <ContextItem label="Periodo" value={context?.periodo ?? "Pendiente"} />
            <ContextItem label="Versión" value={context?.version ?? "Pendiente"} />
          </div>
          <div className="user-chip">
            <span className="user-chip__avatar">AU</span>
            <div>
              <strong>{context?.usuario ?? "Usuario local"}</strong>
              <span>Sesión offline</span>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="context-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
