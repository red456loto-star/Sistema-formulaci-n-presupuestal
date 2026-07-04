import { useState, type FormEvent, type ReactNode } from "react";
import { Coins, Ruler, TrendingUp } from "lucide-react";
import { useCatalog } from "../../lib/useCatalog";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";

type Currency = { id: number; code: string; name: string; symbol: string; decimals: number; active: number };
type ExchangeRate = { id: number; currency_id: number; rate_date: string; buy_rate: number; sell_rate: number; source?: string; active: number };
type Unit = { id: number; code: string; name: string; category: string; active: number };

export function ParametersPage() {
  const [tab, setTab] = useState("Monedas");
  const [message, setMessage] = useState("");
  const currencies = useCatalog<Currency>("monedas");
  const rates = useCatalog<ExchangeRate>("tipos-cambio");
  const units = useCatalog<Unit>("unidades");
  const [currency, setCurrency] = useState({ code: "", name: "", symbol: "", decimals: "2" });
  const [rate, setRate] = useState({ currency_id: "", rate_date: "", buy_rate: "", sell_rate: "", source: "" });
  const [unit, setUnit] = useState({ code: "", name: "", category: "GENERAL" });
  const canCreate = true;

  const run = async (action: () => Promise<unknown>) => {
    setMessage("");
    try { await action(); setMessage("Registro creado correctamente."); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const currencyForm = <form onSubmit={(event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await currencies.create({ ...currency, decimals: Number(currency.decimals), active: true });
      setCurrency({ code: "", name: "", symbol: "", decimals: "2" });
    });
  }}>
    <FormGrid>
      <Field label="Código"><input maxLength={3} value={currency.code} onChange={(e) => setCurrency({ ...currency, code: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field>
      <Field label="Símbolo"><input value={currency.symbol} onChange={(e) => setCurrency({ ...currency, symbol: e.target.value })} required disabled={!canCreate} /></Field>
      <Field label="Nombre"><input value={currency.name} onChange={(e) => setCurrency({ ...currency, name: e.target.value })} required disabled={!canCreate} /></Field>
      <Field label="Decimales"><input type="number" min="0" max="6" value={currency.decimals} onChange={(e) => setCurrency({ ...currency, decimals: e.target.value })} required disabled={!canCreate} /></Field>
    </FormGrid>
    {canCreate && <button className="button button--primary">Crear moneda</button>}
  </form>;

  const rateForm = <form onSubmit={(event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await rates.create({ ...rate, currency_id: Number(rate.currency_id), buy_rate: Number(rate.buy_rate), sell_rate: Number(rate.sell_rate), active: true });
      setRate({ currency_id: "", rate_date: "", buy_rate: "", sell_rate: "", source: "" });
    });
  }}>
    <FormGrid>
      <Field label="Moneda"><select value={rate.currency_id} onChange={(e) => setRate({ ...rate, currency_id: e.target.value })} required disabled={!canCreate}><option value="">Seleccione</option>{currencies.rows.map((row) => <option key={row.id} value={row.id}>{row.code}</option>)}</select></Field>
      <Field label="Fecha"><input type="date" value={rate.rate_date} onChange={(e) => setRate({ ...rate, rate_date: e.target.value })} required disabled={!canCreate} /></Field>
      <Field label="Compra"><input type="number" step="0.0001" value={rate.buy_rate} onChange={(e) => setRate({ ...rate, buy_rate: e.target.value })} required disabled={!canCreate} /></Field>
      <Field label="Venta"><input type="number" step="0.0001" value={rate.sell_rate} onChange={(e) => setRate({ ...rate, sell_rate: e.target.value })} required disabled={!canCreate} /></Field>
      <Field label="Fuente" span={2}><input value={rate.source} onChange={(e) => setRate({ ...rate, source: e.target.value })} disabled={!canCreate} /></Field>
    </FormGrid>
    {canCreate && <button className="button button--primary">Registrar tipo de cambio</button>}
  </form>;

  const unitForm = <form onSubmit={(event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await units.create({ ...unit, active: true });
      setUnit({ code: "", name: "", category: "GENERAL" });
    });
  }}>
    <FormGrid>
      <Field label="Código"><input value={unit.code} onChange={(e) => setUnit({ ...unit, code: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field>
      <Field label="Nombre"><input value={unit.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} required disabled={!canCreate} /></Field>
      <Field label="Categoría" span={2}><input value={unit.category} onChange={(e) => setUnit({ ...unit, category: e.target.value.toUpperCase() })} required disabled={!canCreate} /></Field>
    </FormGrid>
    {canCreate && <button className="button button--primary">Crear unidad</button>}
  </form>;

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 2 · Parámetros</span><h1>Monedas, tipos de cambio y unidades</h1><p>Catálogos transversales que serán utilizados por los módulos presupuestales posteriores.</p></div></section>
    <Tabs items={["Monedas", "Tipos de cambio", "Unidades"]} active={tab} onChange={setTab} />
    {message && <Message type={message.includes("correctamente") ? "success" : "danger"}>{message}</Message>}
    {tab === "Monedas" && <CatalogPanel icon={<Coins />} title="Monedas" form={currencyForm} table={<DataTable headers={["Código", "Nombre", "Símbolo", "Decimales", "Estado"]} rows={currencies.rows.map((row) => [row.code, row.name, row.symbol, row.decimals, row.active ? "Activa" : "Inactiva"])} />} />}
    {tab === "Tipos de cambio" && <CatalogPanel icon={<TrendingUp />} title="Tipos de cambio" form={rateForm} table={<DataTable headers={["Fecha", "Moneda", "Compra", "Venta", "Fuente"]} rows={rates.rows.map((row) => [row.rate_date, currencies.rows.find((item) => item.id === row.currency_id)?.code ?? row.currency_id, row.buy_rate, row.sell_rate, row.source ?? "—"])} />} />}
    {tab === "Unidades" && <CatalogPanel icon={<Ruler />} title="Unidades de medida" form={unitForm} table={<DataTable headers={["Código", "Nombre", "Categoría", "Estado"]} rows={units.rows.map((row) => [row.code, row.name, row.category, row.active ? "Activa" : "Inactiva"])} />} />}
  </div>;
}

function CatalogPanel({ icon, title, form, table }: { icon: ReactNode; title: string; form: ReactNode; table: ReactNode }) {
  return <div className="grid-2 grid-2--wide"><section className="panel"><div className="panel__heading"><div><span className="eyebrow">Nuevo registro</span><h2>{title}</h2></div>{icon}</div>{form}</section><section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Catálogo</span><h2>Registros existentes</h2></div></div>{table}</section></div>;
}
