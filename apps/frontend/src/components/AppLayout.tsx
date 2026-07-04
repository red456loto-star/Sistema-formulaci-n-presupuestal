
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3, BriefcaseBusiness, CalendarRange, ChartNoAxesCombined, CircleDollarSign, FileSpreadsheet,
  Import, LayoutDashboard, Lightbulb, Mail, Menu, PanelLeftClose, PanelLeftOpen, SlidersHorizontal,
  Target, TrendingUp, X,
} from "lucide-react";
import { useWorkspace } from "../context/WorkspaceContext";

const navigation = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/empresas", label: "Empresas y centros", icon: BriefcaseBusiness },
  { to: "/estructura", label: "Estructura presupuestal", icon: Target },
  { to: "/parametros", label: "Tablas maestras", icon: SlidersHorizontal },
  { to: "/periodos", label: "Periodos", icon: CalendarRange },
  { to: "/versiones", label: "Versiones", icon: FileSpreadsheet },
  { to: "/importacion", label: "Importación Excel", icon: Import },
  { to: "/presupuesto-original", label: "Presupuesto original", icon: FileSpreadsheet },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/presupuesto-maestro", label: "Presupuesto maestro", icon: CircleDollarSign },
  { to: "/estados-financieros", label: "Estados financieros", icon: BarChart3 },
  { to: "/analisis", label: "Análisis", icon: ChartNoAxesCombined },
  { to: "/reportes", label: "Reportes", icon: FileSpreadsheet },
  { to: "/propuestas", label: "Propuestas", icon: Lightbulb },
  { to: "/correo", label: "Envío por correo", icon: Mail },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { companies, companyId, setCompanyId } = useWorkspace();
  const sidebarClass = ["sidebar", collapsed ? "sidebar--collapsed" : "", mobileOpen ? "sidebar--mobile-open" : ""].filter(Boolean).join(" ");

  return <div className="app-shell">
    <aside className={sidebarClass}>
      <div className="brand"><div className="brand__mark">PC</div>{!collapsed && <div><strong>PresuControl</strong><span>Gestión presupuestal</span></div>}<button className="icon-button sidebar__mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div>
      <nav className="navigation" aria-label="Navegación principal">{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `navigation__item ${isActive ? "navigation__item--active" : ""}`} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}><Icon size={19} />{!collapsed && <span>{label}</span>}</NavLink>)}</nav>
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
        <div className="local-mode"><strong>Acceso directo</strong><span>Aplicación local sin login</span></div>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  </div>;
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return <div className="context-item"><span>{label}</span><strong>{value}</strong></div>;
}
