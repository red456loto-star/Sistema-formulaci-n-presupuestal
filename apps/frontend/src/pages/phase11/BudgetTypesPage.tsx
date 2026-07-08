import { useEffect, useState, type FormEvent } from "react";
import { Layers3, Pencil, Power } from "lucide-react";
import { DataTable, Field, FormGrid, Message } from "../../components/phase2/Ui";
import { useWorkspace, type BudgetType } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";

const blank = { code: "", name: "", category: "OPERATIVO", description: "", sort_order: "100" };

export function BudgetTypesPage() {
  const { companyId, exerciseId, periodId, versionId, budgetTypes, budgetTypeId, setBudgetTypeId, refreshBudgetTypes, refreshWorkflowStatus } = useWorkspace();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<BudgetType | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = Boolean(companyId && exerciseId && periodId && versionId);

  useEffect(() => { if (!editing) setForm(blank); }, [companyId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true); setMessage("");
    try {
      if (editing) {
        await apiRequest(`/api/phase11/budget-types/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name, category: form.category, description: form.description || null, sort_order: Number(form.sort_order) }) });
        setMessage("Tipo de presupuesto actualizado correctamente.");
      } else {
        const created = await apiRequest<BudgetType>("/api/phase11/budget-types", { method: "POST", body: JSON.stringify({ company_id: companyId, code: form.code, name: form.name, category: form.category, description: form.description || null, sort_order: Number(form.sort_order) }) });
        setBudgetTypeId(created.id);
        setMessage("Tipo de presupuesto creado y seleccionado.");
      }
      setEditing(null); setForm(blank); await refreshBudgetTypes(); await refreshWorkflowStatus();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible guardar el tipo de presupuesto."); }
    finally { setBusy(false); }
  };

  const edit = (row: BudgetType) => {
    setEditing(row);
    setForm({ code: row.code, name: row.name, category: row.category, description: row.description ?? "", sort_order: String(row.sort_order) });
  };

  const toggle = async (row: BudgetType) => {
    setBusy(true); setMessage("");
    try {
      await apiRequest(`/api/phase11/budget-types/${row.id}`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) });
      if (row.id === budgetTypeId && row.active) setBudgetTypeId(null);
      await refreshBudgetTypes(); await refreshWorkflowStatus();
      setMessage(row.active ? "Tipo de presupuesto desactivado." : "Tipo de presupuesto reactivado.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible cambiar el estado."); }
    finally { setBusy(false); }
  };

  return <div className="page-stack phase11-page">
    <section className="page-heading"><div><span className="eyebrow">Paso 3 · Clasificación del flujo</span><h1>Tipos de presupuesto</h1><p>Seleccione el presupuesto que se formulará o analizará. Este dato es independiente de la versión original o forecast.</p></div><span className="status-pill status-pill--success"><Layers3 size={16} /> Contexto obligatorio</span></section>
    {!ready && <Message type="danger">Primero complete empresa, ejercicio, periodo y versión en las dos opciones anteriores.</Message>}
    {message && <Message type={/correctamente|creado|reactivado|desactivado/.test(message) ? "success" : "danger"}>{message}</Message>}
    <section className="phase11-selection-card panel">
      <div className="panel__heading"><div><span className="eyebrow">Tipo activo</span><h2>Presupuesto seleccionado</h2></div></div>
      <Field label="Tipo de presupuesto"><select disabled={!ready} value={budgetTypeId ?? ""} onChange={(event) => { setBudgetTypeId(event.target.value ? Number(event.target.value) : null); void refreshWorkflowStatus(); }}><option value="">Seleccione</option>{budgetTypes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
      <p className="muted">La importación, edición, análisis y reportes se separan por el tipo seleccionado.</p>
    </section>
    <div className="grid-2 grid-2--wide">
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">{editing ? "Edición" : "Nuevo tipo"}</span><h2>{editing ? `Actualizar ${editing.code}` : "Registrar tipo de presupuesto"}</h2></div><Layers3 /></div>
        <form onSubmit={submit}><FormGrid>
          <Field label="Código"><input disabled={!ready || Boolean(editing)} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required /></Field>
          <Field label="Nombre"><input disabled={!ready} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Categoría"><select disabled={!ready} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{["OPERATIVO","COSTOS","FINANCIERO","ESTADO_FINANCIERO","OTRO"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
          <Field label="Orden"><input type="number" min="1" max="999" disabled={!ready} value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></Field>
          <Field label="Descripción" span={2}><textarea rows={3} disabled={!ready} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </FormGrid><div className="button-row"><button className="button button--primary" disabled={!ready || busy}>{editing ? "Guardar cambios" : "Crear tipo"}</button>{editing && <button type="button" className="button button--secondary" onClick={() => { setEditing(null); setForm(blank); }}>Cancelar</button>}</div></form>
      </section>
      <section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Catálogo empresarial</span><h2>Tipos disponibles</h2></div></div>
        <DataTable headers={["Orden", "Código", "Tipo", "Categoría", "Estado", "Acciones"]} rows={budgetTypes.map((row) => [row.sort_order, <strong>{row.code}</strong>, <div><strong>{row.name}</strong><small>{row.description ?? "—"}</small></div>, row.category.replaceAll("_", " "), <span className={`status-dot ${row.active ? "status-dot--active" : ""}`}>{row.active ? "Activo" : "Inactivo"}</span>, <div className="table-actions"><button className="button button--secondary button--compact" onClick={() => edit(row)} disabled={!ready || busy}><Pencil size={13} />Editar</button><button className="button button--secondary button--compact" onClick={() => void toggle(row)} disabled={!ready || busy}><Power size={13} />{row.active ? "Desactivar" : "Activar"}</button><button className="button button--primary button--compact" onClick={() => setBudgetTypeId(row.id)} disabled={!row.active || !ready}>Seleccionar</button></div>])} empty="No existen tipos de presupuesto para la empresa." />
      </section>
    </div>
  </div>;
}
