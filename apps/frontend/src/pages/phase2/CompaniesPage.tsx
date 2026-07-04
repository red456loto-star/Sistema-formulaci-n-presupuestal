import { useMemo, useState, type FormEvent } from "react";
import { Building2, MapPin, UserRoundCog } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useCatalog } from "../../lib/useCatalog";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";

type Company = { id: number; code: string; commercial_name: string; legal_name: string; tax_id: string; sector: string; currency_id: number; email?: string; active: number };
type Site = { id: number; company_id: number; code: string; name: string; city?: string; country?: string; active: number };
type Responsible = { id: number; company_id: number; code: string; full_name: string; position: string; email: string; phone?: string; active: number };
type Currency = { id: number; code: string; name: string };
type CatalogController<T extends { id: number }> = ReturnType<typeof useCatalog<T>>;

export function CompaniesPage() {
  const { companyId, setCompanyId, refreshCompanies } = useWorkspace();
  const [tab, setTab] = useState("Empresas");
  const [message, setMessage] = useState("");
  const companies = useCatalog<Company>("empresas");
  const sites = useCatalog<Site>("sedes", companyId);
  const responsibles = useCatalog<Responsible>("responsables", companyId);
  const currencies = useCatalog<Currency>("monedas");
  const activeCompany = useMemo(() => companies.rows.find((item) => item.id === companyId), [companies.rows, companyId]);

  const run = async (action: () => Promise<unknown>) => {
    setMessage("");
    try {
      await action();
      setMessage("Operación realizada correctamente.");
      await refreshCompanies();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Fase 2 · Organización</span>
          <h1>Empresas, sedes y responsables</h1>
          <p>Administre la estructura organizacional y los responsables que recibirán y gestionarán información presupuestal.</p>
        </div>
      </section>
      <div className="breadcrumb"><span>Organización</span><strong>{activeCompany?.commercial_name ?? "Todas las empresas"}</strong></div>
      <Tabs items={["Empresas", "Sedes", "Responsables"]} active={tab} onChange={setTab} />
      {message && <Message type={message.includes("correctamente") ? "success" : "danger"}>{message}</Message>}
      {tab === "Empresas" && <CompanySection catalog={companies} currencies={currencies.rows} canCreate={true} onSelect={setCompanyId} onRun={run} />}
      {tab === "Sedes" && <SiteSection catalog={sites} companyId={companyId} canCreate={true} onRun={run} />}
      {tab === "Responsables" && <ResponsibleSection catalog={responsibles} companyId={companyId} canCreate={true} onRun={run} />}
    </div>
  );
}

function CompanySection({ catalog, currencies, canCreate, onSelect, onRun }: { catalog: CatalogController<Company>; currencies: Currency[]; canCreate: boolean; onSelect: (id: number) => void; onRun: (action: () => Promise<unknown>) => void }) {
  const [form, setForm] = useState({ code: "", commercial_name: "", legal_name: "", tax_id: "", sector: "", currency_id: "", email: "" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onRun(async () => {
      await catalog.create({ ...form, currency_id: Number(form.currency_id), active: true });
      setForm({ code: "", commercial_name: "", legal_name: "", tax_id: "", sector: "", currency_id: "", email: "" });
    });
  };

  return (
    <div className="grid-2 grid-2--wide">
      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Registro</span><h2>Nueva empresa</h2></div><Building2 /></div>
        {canCreate ? (
          <form onSubmit={submit}>
            <FormGrid>
              <Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></Field>
              <Field label="RUC / identificador"><input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} required /></Field>
              <Field label="Nombre comercial" span={2}><input value={form.commercial_name} onChange={(e) => setForm({ ...form, commercial_name: e.target.value })} required /></Field>
              <Field label="Razón social" span={2}><input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} required /></Field>
              <Field label="Sector"><input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} required /></Field>
              <Field label="Moneda"><select value={form.currency_id} onChange={(e) => setForm({ ...form, currency_id: e.target.value })} required><option value="">Seleccione</option>{currencies.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field>
              <Field label="Correo" span={2}><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </FormGrid>
            <button className="button button--primary">Crear empresa</button>
          </form>
        ) : <Message>No cuenta con permiso para crear empresas.</Message>}
      </section>
      <section className="panel panel--grow">
        <div className="panel__heading"><div><span className="eyebrow">Directorio</span><h2>Empresas registradas</h2></div></div>
        <DataTable headers={["Código", "Empresa", "RUC", "Sector", "Estado", "Acción"]} rows={catalog.rows.map((row) => [row.code, <div><strong>{row.commercial_name}</strong><small>{row.legal_name}</small></div>, row.tax_id, row.sector, <span className={`status-dot ${row.active ? "status-dot--active" : ""}`}>{row.active ? "Activa" : "Inactiva"}</span>, <button className="button button--secondary button--compact" onClick={() => onSelect(row.id)}>Seleccionar</button>])} />
      </section>
    </div>
  );
}

function SiteSection({ catalog, companyId, canCreate, onRun }: { catalog: CatalogController<Site>; companyId: number | null; canCreate: boolean; onRun: (action: () => Promise<unknown>) => void }) {
  const [form, setForm] = useState({ code: "", name: "", city: "", country: "Perú", address: "" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    onRun(async () => {
      await catalog.create({ company_id: companyId, ...form, active: true });
      setForm({ code: "", name: "", city: "", country: "Perú", address: "" });
    });
  };
  if (!companyId) return <Message type="danger">Seleccione una empresa para continuar.</Message>;
  return (
    <section className="panel">
      <div className="panel__heading"><div><span className="eyebrow">Localizaciones</span><h2>Sedes de la empresa activa</h2></div><MapPin /></div>
      <form onSubmit={submit}>
        <FormGrid>
          <Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field>
          <Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!canCreate} /></Field>
          <Field label="Ciudad"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} disabled={!canCreate} /></Field>
          <Field label="País"><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} disabled={!canCreate} /></Field>
          <Field label="Dirección" span={2}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!canCreate} /></Field>
        </FormGrid>
        {canCreate && <button className="button button--primary">Crear sede</button>}
      </form>
      <DataTable headers={["Código", "Sede", "Ciudad", "País", "Estado"]} rows={catalog.rows.map((row) => [row.code, row.name, row.city ?? "—", row.country ?? "—", row.active ? "Activa" : "Inactiva"])} />
    </section>
  );
}

function ResponsibleSection({ catalog, companyId, canCreate, onRun }: { catalog: CatalogController<Responsible>; companyId: number | null; canCreate: boolean; onRun: (action: () => Promise<unknown>) => void }) {
  const [form, setForm] = useState({ code: "", full_name: "", position: "", email: "", phone: "" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    onRun(async () => {
      await catalog.create({ company_id: companyId, ...form, active: true });
      setForm({ code: "", full_name: "", position: "", email: "", phone: "" });
    });
  };
  if (!companyId) return <Message type="danger">Seleccione una empresa para continuar.</Message>;
  return (
    <section className="panel">
      <div className="panel__heading"><div><span className="eyebrow">Responsabilidad</span><h2>Responsables presupuestales</h2></div><UserRoundCog /></div>
      <form onSubmit={submit}>
        <FormGrid>
          <Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field>
          <Field label="Nombre completo"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required disabled={!canCreate} /></Field>
          <Field label="Cargo"><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} required disabled={!canCreate} /></Field>
          <Field label="Correo"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!canCreate} /></Field>
          <Field label="Teléfono"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canCreate} /></Field>
        </FormGrid>
        {canCreate && <button className="button button--primary">Crear responsable</button>}
      </form>
      <DataTable headers={["Código", "Responsable", "Cargo", "Correo", "Estado"]} rows={catalog.rows.map((row) => [row.code, row.full_name, row.position, row.email, row.active ? "Activo" : "Inactivo"])} />
    </section>
  );
}
