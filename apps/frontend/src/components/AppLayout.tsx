import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3, BriefcaseBusiness, CalendarRange, ChartNoAxesCombined, CircleDollarSign, Database, FileSpreadsheet,
  Gauge, History, Import, LayoutDashboard, Lightbulb, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings,
  ShieldCheck, SlidersHorizontal, Target, TrendingUp, UserCog, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

const navigation = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/empresas", label: "Empresas", icon: BriefcaseBusiness, permission: "EMPRESAS:LEER" },
  { to: "/estructura", label: "Estructura presupuestal", icon: Target, permission: "ESTRUCTURA:LEER" },
  { to: "/usuarios", label: "Usuarios y roles", icon: UserCog, permission: "USUARIOS:LEER" },
  { to: "/parametros", label: "Parámetros", icon: SlidersHorizontal, permission: "PARAMETROS:LEER" },
  { to: "/auditoria", label: "Auditoría", icon: History, permission: "AUDITORIA:LEER" },
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
  { to: "/estado-sistema", label: "Estado del sistema", icon: Database, permission: "SISTEMA:LEER" },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const { companies, companyId, setCompanyId } = useWorkspace();
  const visibleNavigation = navigation.filter((item) => !item.permission || hasPermission(item.permission));
  const sidebarClass = ["sidebar", collapsed ? "sidebar--collapsed" : "", mobileOpen ? "sidebar--mobile-open" : ""].filter(Boolean).join(" ");

  return <div className="app-shell">
    <aside className={sidebarClass}>
      <div className="brand"><div className="brand__mark">PC</div>{!collapsed && <div><strong>PresuControl</strong><span>Gestión presupuestal</span></div>}<button className="icon-button sidebar__mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div>
      <nav className="navigation" aria-label="Navegación principal">{visibleNavigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `navigation__item ${isActive ? "navigation__item--active" : ""}`} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}><Icon size={19} />{!collapsed && <span>{label}</span>}</NavLink>)}</nav>
      <button className="sidebar__collapse" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}{!collapsed && <span>Contraer menú</span>}</button>
    </aside>
    {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}
    <div className={`workspace ${collapsed ? "workspace--expanded" : ""}`}>
      <header className="topbar">
        <button className="icon-button topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
        <div className="context-grid">
          <div className="context-item context-item--select"><span>Empresa</span><select value={companyId ?? ""} onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}><option value="">Sin seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.commercial_name}</option>)}</select></div>
          <ContextItem label="Ejercicio" value="2027" />
          <ContextItem label="Periodo" value="Enero" />
          <ContextItem label="Versión" value="Original 1.0" />
        </div>
        <div className="user-chip"><span className="user-chip__avatar">{user?.fullName.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{user?.fullName}</strong><span>{user?.roles.join(", ")}</span></div><button className="icon-button icon-button--quiet" onClick={() => logout()} title="Cerrar sesión"><LogOut size={17} /></button></div>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  </div>;
}

function ContextItem({ label, value }: { label: string; value: string }) { return <div className="context-item"><span>{label}</span><strong>{value}</strong></div>; }
