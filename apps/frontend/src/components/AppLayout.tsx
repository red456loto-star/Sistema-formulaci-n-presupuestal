import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3, BriefcaseBusiness, CalendarRange, ClipboardList, Database, LayoutDashboard, Layers3, Lightbulb, LockKeyhole,
  Mail, Menu, PanelLeftClose, PanelLeftOpen, Scale, Target, X,
} from "lucide-react";
import { requirementSatisfied, type Phase11Requirement } from "./Phase11RouteGuard";
import { useWorkspace } from "../context/WorkspaceContext";

const navigation: Array<{ to: string; label: string; icon: typeof BriefcaseBusiness; requirement?: Phase11Requirement; step: number }> = [
  { to: "/empresa-perfil", label: "Empresa y perfil", icon: BriefcaseBusiness, step: 1 },
  { to: "/periodos-versiones", label: "Periodos y versiones", icon: CalendarRange, requirement: "COMPANY", step: 2 },
  { to: "/tipos-presupuesto", label: "Tipos de presupuesto", icon: Layers3, requirement: "PERIOD_VERSION", step: 3 },
  { to: "/tablas-maestras", label: "Tablas maestras", icon: Database, requirement: "BUDGET_TYPE", step: 4 },
  { to: "/presupuesto-maestro", label: "Presupuesto maestro", icon: ClipboardList, requirement: "MASTER_DATA", step: 5 },
  { to: "/analisis-financiero-integral", label: "Análisis financiero integral", icon: BarChart3, requirement: "MASTER_DATA", step: 6 },
  { to: "/relevancia-costos", label: "Relevancia de costos", icon: Target, requirement: "MASTER_DATA", step: 7 },
  { to: "/variaciones", label: "Análisis de variaciones", icon: Scale, requirement: "MASTER_DATA", step: 8 },
  { to: "/dashboard-presupuestal", label: "Dashboard de presupuestos", icon: LayoutDashboard, requirement: "MASTER_DATA", step: 9 },
  { to: "/propuestas", label: "Propuestas de mejora", icon: Lightbulb, requirement: "MASTER_DATA", step: 10 },
  { to: "/correo", label: "Envío por correo", icon: Mail, requirement: "MASTER_DATA", step: 11 },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const workspace = useWorkspace();
  const {
    companies, companyId, setCompanyId,
    exercises, exerciseId, setExerciseId,
    periods, periodId, setPeriodId,
    versions, versionId, setVersionId,
    budgetTypes, budgetTypeId, setBudgetTypeId,
  } = workspace;
  const sidebarClass = ["sidebar", collapsed ? "sidebar--collapsed" : "", mobileOpen ? "sidebar--mobile-open" : ""].filter(Boolean).join(" ");

  return <div className="app-shell">
    <aside className={sidebarClass}>
      <div className="brand"><div className="brand__mark">PC</div>{!collapsed && <div><strong>PresuControl</strong><span>Gestión presupuestal</span></div>}<button className="icon-button sidebar__mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div>
      <nav className="navigation phase11-navigation" aria-label="Navegación principal">{navigation.map(({ to, label, icon: Icon, requirement, step }) => {
        const enabled = !requirement || requirementSatisfied(requirement, workspace);
        if (!enabled) return <div key={to} className="navigation__item navigation__item--disabled" title="Complete primero las opciones anteriores"><span className="navigation__step">{step}</span><Icon size={18} />{!collapsed && <span>{label}</span>}<LockKeyhole className="navigation__lock" size={13} /></div>;
        return <NavLink key={to} to={to} className={({ isActive }) => `navigation__item ${isActive ? "navigation__item--active" : ""}`} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}><span className="navigation__step">{step}</span><Icon size={18} />{!collapsed && <span>{label}</span>}</NavLink>;
      })}</nav>
      <button className="sidebar__collapse" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}{!collapsed && <span>Contraer menú</span>}</button>
    </aside>
    {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}
    <div className={`workspace ${collapsed ? "workspace--expanded" : ""}`}>
      <header className="topbar phase11-topbar">
        <button className="icon-button topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
        <div className="context-grid phase11-context-grid">
          <ContextSelect label="Empresa" value={companyId} onChange={setCompanyId} disabled={false} options={companies.filter((item) => item.active).map((item) => ({ id: item.id, label: item.commercial_name }))} />
          <ContextSelect label="Ejercicio" value={exerciseId} onChange={setExerciseId} disabled={!companyId} options={exercises.filter((item) => item.active).map((item) => ({ id: item.id, label: `${item.code} · ${item.budget_year}` }))} />
          <ContextSelect label="Periodo" value={periodId} onChange={setPeriodId} disabled={!exerciseId} options={periods.map((item) => ({ id: item.id, label: `${String(item.period_number).padStart(2, "0")} · ${item.name}${item.status === "CERRADO" ? " (cerrado)" : ""}` }))} />
          <ContextSelect label="Versión" value={versionId} onChange={setVersionId} disabled={!exerciseId} options={versions.map((item) => ({ id: item.id, label: `${item.code} · ${item.version_type} · ${item.status}` }))} />
          <ContextSelect label="Tipo de presupuesto" value={budgetTypeId} onChange={setBudgetTypeId} disabled={!companyId || !exerciseId || !periodId || !versionId} options={budgetTypes.filter((item) => item.active).map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }))} />
        </div>
        <div className="local-mode"><strong>Flujo corregido</strong><span>Trabajo jerárquico</span></div>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  </div>;
}

function ContextSelect({ label, value, onChange, disabled, options }: {
  label: string; value: number | null; onChange: (id: number | null) => void; disabled: boolean; options: Array<{ id: number; label: string }>;
}) {
  return <div className="context-item context-item--select"><span>{label}</span><select value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}><option value="">Sin seleccionar</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>;
}
