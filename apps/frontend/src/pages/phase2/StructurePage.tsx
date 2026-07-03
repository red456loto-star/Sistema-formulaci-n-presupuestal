import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Building, FolderTree, Landmark, ListTree, WalletCards } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import { useCatalog } from "../../lib/useCatalog";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";

type Site = { id: number; code: string; name: string };
type Responsible = { id: number; code: string; full_name: string; email: string };
type Center = { id: number; company_id: number; site_id: number; responsible_id?: number; code: string; name: string; center_type: string; active: number };
type Group = { id: number; company_id: number; code: string; name: string; description?: string; active: number };
type Element = { id: number; company_id: number; group_id: number; code: string; name: string; description?: string; active: number };
type Account = { id: number; company_id: number; element_id: number; code: string; name: string; nature: string; movement_type: string; active: number };
type Hierarchy = { company: { id: number; code: string; commercial_name: string }; organizational: Array<Site & { centers: Array<Center & { responsible_name?: string; responsible_email?: string }> }>; budget: Array<Group & { elements: Array<Element & { accounts: Account[] }> }> };
type CatalogController<T extends { id: number }> = ReturnType<typeof useCatalog<T>>;

export function StructurePage() {
  const { companyId, company } = useWorkspace();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState("Árbol jerárquico");
  const [message, setMessage] = useState("");
  const [hierarchy, setHierarchy] = useState<Hierarchy | null>(null);
  const sites = useCatalog<Site>("sedes", companyId);
  const responsibles = useCatalog<Responsible>("responsables", companyId);
  const centers = useCatalog<Center>("centros", companyId);
  const groups = useCatalog<Group>("grupos", companyId);
  const elements = useCatalog<Element>("elementos", companyId);
  const accounts = useCatalog<Account>("cuentas", companyId);

  const refreshHierarchy = async () => {
    if (!companyId) { setHierarchy(null); return; }
    setHierarchy(await apiRequest<Hierarchy>(`/api/organization/hierarchy?company_id=${companyId}`));
  };

  useEffect(() => {
    refreshHierarchy().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [companyId, centers.rows.length, groups.rows.length, elements.rows.length, accounts.rows.length]);

  const run = async (action: () => Promise<unknown>) => {
    setMessage("");
    try {
      await action();
      setMessage("Registro creado correctamente.");
      await refreshHierarchy();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  if (!companyId) return <div className="page-stack"><section className="page-heading"><div><span className="eyebrow">Fase 2 · Estructura</span><h1>Estructura presupuestal</h1></div></section><Message type="danger">Seleccione una empresa en la barra superior antes de administrar la estructura.</Message></div>;

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 2 · Estructura</span><h1>Jerarquía organizacional y presupuestal</h1><p>La empresa, sedes y centros se mantienen separados del catálogo de grupos, elementos y cuentas. Las líneas presupuestales relacionarán ambas estructuras en fases posteriores.</p></div></section>
    <div className="breadcrumb"><span>Empresa</span><strong>{company?.commercial_name}</strong><span>Centro + Cuenta</span></div>
    <Tabs items={["Árbol jerárquico", "Centros", "Grupos", "Elementos", "Cuentas"]} active={tab} onChange={setTab} />
    {message && <Message type={message.includes("correctamente") ? "success" : "danger"}>{message}</Message>}
    {tab === "Árbol jerárquico" && <HierarchyView hierarchy={hierarchy} />}
    {tab === "Centros" && <CenterSection companyId={companyId} catalog={centers} sites={sites.rows} responsibles={responsibles.rows} canCreate={hasPermission("ESTRUCTURA:CREAR")} run={run} />}
    {tab === "Grupos" && <GroupSection companyId={companyId} catalog={groups} canCreate={hasPermission("ESTRUCTURA:CREAR")} run={run} />}
    {tab === "Elementos" && <ElementSection companyId={companyId} catalog={elements} groups={groups.rows} canCreate={hasPermission("ESTRUCTURA:CREAR")} run={run} />}
    {tab === "Cuentas" && <AccountSection companyId={companyId} catalog={accounts} elements={elements.rows} groups={groups.rows} canCreate={hasPermission("ESTRUCTURA:CREAR")} run={run} />}
  </div>;
}

function HierarchyView({ hierarchy }: { hierarchy: Hierarchy | null }) {
  if (!hierarchy) return <section className="panel"><p className="muted">Cargando jerarquía...</p></section>;
  return <div className="hierarchy-grid">
    <section className="panel">
      <div className="panel__heading"><div><span className="eyebrow">Estructura organizacional</span><h2>Empresa → sede → centro</h2></div><Building /></div>
      <div className="tree">
        <div className="tree__root"><Landmark size={18} /><strong>{hierarchy.company.commercial_name}</strong></div>
        {hierarchy.organizational.map((site) => <div className="tree__branch" key={site.id}><div className="tree__node"><span>{site.code}</span><strong>{site.name}</strong></div>{site.centers.map((center) => <div className="tree__leaf" key={center.id}><span>{center.code}</span><div><strong>{center.name}</strong><small>{center.responsible_name ? `${center.responsible_name} · ${center.responsible_email}` : "Sin responsable"}</small></div></div>)}</div>)}
      </div>
    </section>
    <section className="panel">
      <div className="panel__heading"><div><span className="eyebrow">Estructura presupuestal</span><h2>Grupo → elemento → cuenta</h2></div><FolderTree /></div>
      <div className="tree">{hierarchy.budget.map((group) => <div className="tree__branch" key={group.id}><div className="tree__root"><span>{group.code}</span><strong>{group.name}</strong></div>{group.elements.map((element) => <div className="tree__branch tree__branch--nested" key={element.id}><div className="tree__node"><span>{element.code}</span><strong>{element.name}</strong></div>{element.accounts.map((account) => <div className="tree__leaf" key={account.id}><span>{account.code}</span><div><strong>{account.name}</strong><small>{account.nature} · {account.movement_type}</small></div></div>)}</div>)}</div>)}</div>
    </section>
  </div>;
}

function CenterSection({ companyId, catalog, sites, responsibles, canCreate, run }: { companyId: number; catalog: CatalogController<Center>; sites: Site[]; responsibles: Responsible[]; canCreate: boolean; run: (action: () => Promise<unknown>) => void }) {
  const [form, setForm] = useState({ site_id: "", responsible_id: "", code: "", name: "", center_type: "APOYO", description: "" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await catalog.create({ company_id: companyId, ...form, site_id: Number(form.site_id), responsible_id: form.responsible_id ? Number(form.responsible_id) : null, active: true });
      setForm({ site_id: "", responsible_id: "", code: "", name: "", center_type: "APOYO", description: "" });
    });
  };
  return <CatalogLayout icon={<Building />} title="Centros de actividad" form={<form onSubmit={submit}><FormGrid><Field label="Sede"><select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })} required disabled={!canCreate}><option value="">Seleccione</option>{sites.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field><Field label="Responsable"><select value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })} disabled={!canCreate}><option value="">Sin responsable</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field><Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field><Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!canCreate} /></Field><Field label="Tipo"><select value={form.center_type} onChange={(e) => setForm({ ...form, center_type: e.target.value })} disabled={!canCreate}>{["PRODUCTIVO", "APOYO", "COMERCIAL", "ADMINISTRATIVO"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Descripción"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canCreate} /></Field></FormGrid>{canCreate && <button className="button button--primary">Crear centro</button>}</form>} table={<DataTable headers={["Código", "Centro", "Sede", "Responsable", "Tipo", "Estado"]} rows={catalog.rows.map((row) => [row.code, row.name, sites.find((item) => item.id === row.site_id)?.name ?? row.site_id, responsibles.find((item) => item.id === row.responsible_id)?.full_name ?? "Sin responsable", row.center_type, row.active ? "Activo" : "Inactivo"])} />} />;
}

function GroupSection({ companyId, catalog, canCreate, run }: { companyId: number; catalog: CatalogController<Group>; canCreate: boolean; run: (action: () => Promise<unknown>) => void }) {
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  return <CatalogLayout icon={<ListTree />} title="Grupos presupuestales" form={<form onSubmit={(event) => { event.preventDefault(); run(async () => { await catalog.create({ company_id: companyId, ...form, active: true }); setForm({ code: "", name: "", description: "" }); }); }}><FormGrid><Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field><Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!canCreate} /></Field><Field label="Descripción" span={2}><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canCreate} /></Field></FormGrid>{canCreate && <button className="button button--primary">Crear grupo</button>}</form>} table={<DataTable headers={["Código", "Grupo", "Descripción", "Estado"]} rows={catalog.rows.map((row) => [row.code, row.name, row.description ?? "—", row.active ? "Activo" : "Inactivo"])} />} />;
}

function ElementSection({ companyId, catalog, groups, canCreate, run }: { companyId: number; catalog: CatalogController<Element>; groups: Group[]; canCreate: boolean; run: (action: () => Promise<unknown>) => void }) {
  const [form, setForm] = useState({ group_id: "", code: "", name: "", description: "" });
  return <CatalogLayout icon={<FolderTree />} title="Elementos presupuestales" form={<form onSubmit={(event) => { event.preventDefault(); run(async () => { await catalog.create({ company_id: companyId, ...form, group_id: Number(form.group_id), active: true }); setForm({ group_id: "", code: "", name: "", description: "" }); }); }}><FormGrid><Field label="Grupo"><select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} required disabled={!canCreate}><option value="">Seleccione</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field><Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field><Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!canCreate} /></Field><Field label="Descripción"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canCreate} /></Field></FormGrid>{canCreate && <button className="button button--primary">Crear elemento</button>}</form>} table={<DataTable headers={["Código", "Elemento", "Grupo", "Estado"]} rows={catalog.rows.map((row) => [row.code, row.name, groups.find((item) => item.id === row.group_id)?.name ?? row.group_id, row.active ? "Activo" : "Inactivo"])} />} />;
}

function AccountSection({ companyId, catalog, elements, groups, canCreate, run }: { companyId: number; catalog: CatalogController<Account>; elements: Element[]; groups: Group[]; canCreate: boolean; run: (action: () => Promise<unknown>) => void }) {
  const [form, setForm] = useState({ element_id: "", code: "", name: "", nature: "GASTO", movement_type: "DETALLE", description: "" });
  const elementMap = useMemo(() => new Map(elements.map((item) => [item.id, item])), [elements]);
  return <CatalogLayout icon={<WalletCards />} title="Cuentas presupuestales" form={<form onSubmit={(event) => { event.preventDefault(); run(async () => { await catalog.create({ company_id: companyId, ...form, element_id: Number(form.element_id), active: true }); setForm({ element_id: "", code: "", name: "", nature: "GASTO", movement_type: "DETALLE", description: "" }); }); }}><FormGrid><Field label="Elemento"><select value={form.element_id} onChange={(e) => setForm({ ...form, element_id: e.target.value })} required disabled={!canCreate}><option value="">Seleccione</option>{elements.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field><Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!canCreate} /></Field><Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!canCreate} /></Field><Field label="Naturaleza"><select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })} disabled={!canCreate}>{["INGRESO", "COSTO", "GASTO", "ACTIVO", "PASIVO", "PATRIMONIO"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Movimiento"><select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value })} disabled={!canCreate}><option>DETALLE</option><option>ACUMULADORA</option></select></Field><Field label="Descripción"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canCreate} /></Field></FormGrid>{canCreate && <button className="button button--primary">Crear cuenta</button>}</form>} table={<DataTable headers={["Código", "Cuenta", "Ruta presupuestal", "Naturaleza", "Movimiento", "Estado"]} rows={catalog.rows.map((row) => { const element = elementMap.get(row.element_id); const group = groups.find((item) => item.id === element?.group_id); return [row.code, row.name, `${group?.name ?? "—"} → ${element?.name ?? "—"}`, row.nature, row.movement_type, row.active ? "Activa" : "Inactiva"]; })} />} />;
}

function CatalogLayout({ icon, title, form, table }: { icon: ReactNode; title: string; form: ReactNode; table: ReactNode }) {
  return <div className="grid-2 grid-2--wide"><section className="panel"><div className="panel__heading"><div><span className="eyebrow">Nuevo registro</span><h2>{title}</h2></div>{icon}</div>{form}</section><section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Catálogo</span><h2>Registros existentes</h2></div></div>{table}</section></div>;
}
