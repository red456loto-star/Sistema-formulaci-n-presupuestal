import { useEffect, useState, type FormEvent } from "react";
import { Layers3, Pencil, Power } from "lucide-react";
import { DataTable, Field, FormGrid, Message } from "../../components/phase2/Ui";
import { useWorkspace, type BudgetType } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";

const blank = { code: "", name: "", category: "OTRO", description: "", sort_order: "100" };
const allowedCodes = new Set(["ORIGINAL_ANUAL_MENSUAL", "PROYECTADO_TRES_ANIOS_ANUAL", "FORECAST_REVISADO"]);
const retiredCodes = new Set(["ORIGINAL_ANUAL_PROYECTADO", "VENTAS", "PRODUCCION", "COMPRAS", "COSTOS", "GASTOS", "INVERSIONES", "CAJA", "ESTADO_RESULTADOS", "ESTADO_SITUACION", "FLUJO_EFECTIVO"]);

export function BudgetTypesPage() {
  const { companyId, exerciseId, periodId, versionId, budgetTypes, budgetTypeId, setBudgetTypeId, refreshBudgetTypes, refreshWorkflowStatus } = useWorkspace();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<BudgetType | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = Boolean(companyId && exerciseId && periodId && versionId);
  const visibleBudgetTypes = budgetTypes.filter((item) => !retiredCodes.has(item.code) && (allowedCodes.has(item.code) || item.category === "OTRO"));
  const activeBudgetTypes = visibleBudgetTypes.filter((item) => item.active);

  useEffect(() => { if (!editing) setForm(blank); }, [companyId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true); setMessage("");
    try {
      const payload = { name: form.name, category: "OTRO", description: form.description || null, sort_order: Number(form.sort_order) };
      if (editing) {
        await apiRequest(`/api/phase11/budget-types/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Tipo de presupuesto actualizado correctamente.");
      } else {
        const created = await apiRequest<BudgetType>("/api/phase11/budget-types", { method: "POST", body: JSON.stringify({ company_id: companyId, code: form.code, ...payload }) });
        setBudgetTypeId(created.id);
        setMessage("Tipo de presupuesto creado y seleccionado.");
      }
      setEditing(null); setForm(blank); await refreshBudgetTypes(); await refreshWorkflowStatus();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible guardar el tipo de presupuesto."); }
    finally { setBusy(false); }
  };

  const edit = (row: BudgetType) => {
    setEditing(row);
    setForm({ code: row.code, name: row.name, category: "OTRO", description: row.description ?? "", sort_order: String(row.sort_order) });
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
    <section className="page-heading"><div><span className="eyebrow">Paso 3 · Modalidad presupuestal</span><h1>Tipos de presupuesto</h1><p>Seleccione entre presupuesto original anual mensual, presupuesto proyectado a tres años anual o presupuesto revisado forecast. Los componentes del presupuesto maestro se muestran en una opción separada después de Tablas maestras.</p></div><span className="status-pill status-pill--success"><Layers3 size={16} /> Contexto obligatorio</span></section>
    {!ready && <Message type="danger">Primero complete empresa, ejercicio, periodo y versión en las dos opciones anteriores.</Message>}
    {message && <Message type={/correctamente|creado|reactivado|desactivado/.test(message) ? "success" : "danger"}>{message}</Message>}
    <section className="phase11-selection-card panel">
      <div className="panel__heading"><div><span className="eyebrow">Tipo activo</span><h2>Presupuesto seleccionado</h2></div></div>
      <Field label="Tipo de presupuesto"><select disabled={!ready} value={budgetTypeId ?? ""} onChange={(event) => { setBudgetTypeId(event.target.value ? Number(event.target.value) : null); void refreshWorkflowStatus(); }}><option value="">Seleccione</option>{activeBudgetTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <p className="muted">Esta selección define si la información maestra corresponde al presupuesto original mensual, al presupuesto proyectado anual o al forecast revisado.</p>
    </section>
    <div className="grid-2 grid-2--wide">
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">{editing ? "Edición" : "Nuevo tipo"}</span><h2>{editing ? `Actualizar ${editing.code}` : "Registrar tipo de presupuesto"}</h2></div><Layers3 /></div>
        <form onSubmit={submit}><FormGrid>
          <Field label="Código"><input disabled={!ready || Boolean(editing)} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replaceAll(" ", "_") })} required placeholder="Ej. ESCENARIO_ESPECIAL" /></Field>
          <Field label="Nombre"><input disabled={!ready} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Uso"><input disabled value="Modalidad presupuestal" /></Field>
          <Field label="Orden"><input type="number" min="1" max="999" disabled={!ready} value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></Field>
          <Field label="Descripción" span={2}><textarea rows={3} disabled={!ready} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </FormGrid><Message>El presupuesto original anual mensual y el presupuesto proyectado a tres años anual son modalidades separadas. Los presupuestos de ventas, inventarios, compras, producción, costos, gastos, inversión y estados financieros se visualizan en Presupuesto maestro después de subir la data.</Message><div className="button-row"><button className="button button--primary" disabled={!ready || busy}>{editing ? "Guardar cambios" : "Crear tipo"}</button>{editing && <button type="button" className="button button--secondary" onClick={() => { setEditing(null); setForm(blank); }}>Cancelar</button>}</div></form>
      </section>
      <section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Catálogo empresarial</span><h2>Tipos disponibles</h2></div></div>
        <DataTable headers={["Orden", "Código", "Tipo", "Estado", "Acciones"]} rows={visibleBudgetTypes.map((row) => [row.sort_order, <strong>{row.code}</strong>, <div><strong>{row.name}</strong><small>{row.description ?? "—"}</small></div>, <span className={`status-dot ${row.active ? "status-dot--active" : ""}`}>{row.active ? "Activo" : "Inactivo"}</span>, <div className="table-actions"><button className="button button--secondary button--compact" onClick={() => edit(row)} disabled={!ready || busy}><Pencil size={13} />Editar</button><button className="button button--secondary button--compact" onClick={() => void toggle(row)} disabled={!ready || busy}><Power size={13} />{row.active ? "Desactivar" : "Activar"}</button><button className="button button--primary button--compact" onClick={() => setBudgetTypeId(row.id)} disabled={!row.active || !ready}>Seleccionar</button></div>])} empty="No existen tipos de presupuesto para la empresa." />
      </section>
    </div>
  </div>;
}
