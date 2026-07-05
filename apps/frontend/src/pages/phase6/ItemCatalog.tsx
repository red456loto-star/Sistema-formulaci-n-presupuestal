import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { postJson } from "../../lib/api";
import { Field, FormGrid, Message } from "../../components/phase2/Ui";
import type { MasterItem, Option } from "./types";

export function ItemCatalog({
  companyId,
  items,
  units,
  locked,
  onChanged,
}: {
  companyId: number;
  items: MasterItem[];
  units: Option[];
  locked: boolean;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState({ code: "", name: "", item_type: "PRODUCTO", unit_id: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const save = async () => {
    setBusy(true); setError(""); setSuccess("");
    try {
      if (!form.code.trim() || !form.name.trim()) throw new Error("Complete código y nombre.");
      const result = await postJson<{ message: string }>("/api/master-budget/items", {
        company_id: companyId,
        code: form.code,
        name: form.name,
        item_type: form.item_type,
        unit_id: form.unit_id ? Number(form.unit_id) : null,
        active: true,
      });
      setSuccess(result.message);
      setForm({ code: "", name: "", item_type: "PRODUCTO", unit_id: "" });
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar el producto o material.");
    } finally { setBusy(false); }
  };

  return <section className="panel">
    <div className="panel__heading"><div><span className="eyebrow">Catálogo mínimo</span><h2>Productos y materiales</h2><p>Registros usados por ventas, producción, inventarios, compras y costos.</p></div><Plus size={22} /></div>
    {error && <Message type="danger">{error}</Message>}
    {success && <Message type="success">{success}</Message>}
    {!locked && <><FormGrid>
      <Field label="Código"><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></Field>
      <Field label="Nombre" span={2}><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
      <Field label="Tipo"><select value={form.item_type} onChange={(event) => setForm((current) => ({ ...current, item_type: event.target.value }))}><option value="PRODUCTO">Producto</option><option value="MATERIAL">Material</option></select></Field>
      <Field label="Unidad"><select value={form.unit_id} onChange={(event) => setForm((current) => ({ ...current, unit_id: event.target.value }))}><option value="">Sin unidad</option>{units.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
    </FormGrid><div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void save()}><Save size={16} />Guardar ítem</button></div></>}
    <div className="master-item-list">{items.length ? items.map((item) => <article key={item.id}><strong>{item.code}</strong><span>{item.name}</span><small>{item.item_type} · {item.unit_code ?? "Sin unidad"}</small></article>) : <p className="muted">Todavía no se registraron productos o materiales.</p>}</div>
  </section>;
}
