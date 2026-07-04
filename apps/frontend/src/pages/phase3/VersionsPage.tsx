import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Copy, FileClock, LockKeyhole, Pencil, Replace } from "lucide-react";
import { DataTable, Field, FormGrid, Message } from "../../components/phase2/Ui";
import { apiRequest, patchJson, postJson } from "../../lib/api";
import { useCatalog } from "../../lib/useCatalog";
import { useWorkspace, type BudgetVersion } from "../../context/WorkspaceContext";

type Responsible = { id: number; full_name: string; position: string; active: number };
type VersionRow = BudgetVersion & {
  source_version_id?: number | null;
  responsible_id?: number | null;
  responsible_name?: string | null;
  source_version_code?: string | null;
  copied_from_code?: string | null;
  period_name?: string | null;
  notes?: string | null;
};
type HistoryRow = { id: number; from_status?: string | null; to_status: string; responsible_name?: string | null; notes?: string | null; created_at: string };
type ActionKind = "APROBAR" | "CERRAR" | "REEMPLAZAR" | "COPIAR" | "HISTORIAL" | null;
const blankForm = { code: "", name: "", version_type: "ORIGINAL", period_id: "", source_version_id: "", responsible_id: "", version_number: "", notes: "" };

export function VersionsPage() {
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<VersionRow | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [actionForm, setActionForm] = useState({ responsible_id: "", notes: "", replacement_version_id: "", code: "", name: "" });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const { companyId, exerciseId, periods, versions, refreshVersions, setVersionId } = useWorkspace();
  const responsibles = useCatalog<Responsible>("responsables", companyId);
  const rows = versions as VersionRow[];

  useEffect(() => { setEditingId(null); setForm(blankForm); setSelected(null); setAction(null); setHistory([]); }, [companyId, exerciseId]);

  const run = async (operation: () => Promise<void>, success: string) => {
    setMessage("");
    try { await operation(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const originals = rows.filter((item) => item.version_type === "ORIGINAL" && ["APROBADO", "CERRADO"].includes(item.status));
  const submitVersion = (event: FormEvent) => {
    event.preventDefault();
    if (!companyId || !exerciseId) { setMessage("Seleccione empresa y ejercicio para continuar."); return; }
    void run(async () => {
      const payload = {
        company_id: companyId,
        exercise_id: exerciseId,
        code: form.code,
        name: form.name,
        version_type: form.version_type,
        period_id: form.period_id ? Number(form.period_id) : null,
        source_version_id: form.source_version_id ? Number(form.source_version_id) : null,
        responsible_id: form.responsible_id ? Number(form.responsible_id) : null,
        version_number: form.version_number ? Number(form.version_number) : undefined,
        notes: form.notes || null,
      };
      if (editingId) await patchJson(`/api/catalog/versiones/${editingId}`, payload);
      else {
        const created = await postJson<{ id: number }>("/api/catalog/versiones", payload);
        setVersionId(created.id);
      }
      await refreshVersions();
      setEditingId(null);
      setForm(blankForm);
    }, editingId ? "Versión actualizada correctamente." : "Versión creada correctamente.");
  };

  const editVersion = (row: VersionRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      version_type: row.version_type,
      period_id: row.period_id ? String(row.period_id) : "",
      source_version_id: row.source_version_id ? String(row.source_version_id) : "",
      responsible_id: row.responsible_id ? String(row.responsible_id) : "",
      version_number: String(row.version_number),
      notes: row.notes ?? "",
    });
    setMessage("");
  };

  const startAction = (row: VersionRow, kind: ActionKind) => {
    setSelected(row);
    setAction(kind);
    setHistory([]);
    setActionForm({ responsible_id: row.responsible_id ? String(row.responsible_id) : "", notes: "", replacement_version_id: "", code: `${row.code}-COPIA`, name: `${row.name} (copia)` });
    if (kind === "HISTORIAL") {
      void apiRequest<HistoryRow[]>(`/api/catalog/versiones/${row.id}/historial`)
        .then(setHistory)
        .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    }
  };

  const submitAction = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !action) return;
    void run(async () => {
      if (action === "COPIAR") {
        const created = await postJson<{ id: number }>(`/api/catalog/versiones/${selected.id}/copiar`, {
          code: actionForm.code,
          name: actionForm.name,
          responsible_id: actionForm.responsible_id ? Number(actionForm.responsible_id) : null,
          notes: actionForm.notes || null,
        });
        setVersionId(created.id);
      } else if (action === "REEMPLAZAR") {
        await postJson(`/api/catalog/versiones/${selected.id}/reemplazar`, {
          responsible_id: Number(actionForm.responsible_id),
          notes: actionForm.notes,
          replacement_version_id: Number(actionForm.replacement_version_id),
        });
      } else {
        await postJson(`/api/catalog/versiones/${selected.id}/${action === "APROBAR" ? "aprobar" : "cerrar"}`, {
          responsible_id: Number(actionForm.responsible_id),
          notes: actionForm.notes,
        });
      }
      await refreshVersions();
      setSelected(null);
      setAction(null);
    }, action === "COPIAR" ? "Versión copiada correctamente." : `Acción ${action.toLowerCase()} registrada correctamente.`);
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 3 · Multiversiones</span><h1>Versiones presupuestales</h1><p>Crea versiones originales y forecast, controla sus estados y conserva la trazabilidad sin utilizar cuentas de usuario.</p></div><span className="status-pill status-pill--success"><FileClock size={16} /> Historial activo</span></section>
    {(!companyId || !exerciseId) && <Message type="danger">Seleccione empresa y ejercicio en la barra superior.</Message>}
    {message && <Message type={message.includes("correctamente") || message.includes("registrada") ? "success" : "danger"}>{message}</Message>}

    <div className="grid-2 grid-2--wide">
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">{editingId ? "Edición" : "Nueva versión"}</span><h2>{editingId ? "Actualizar borrador" : "Registrar versión"}</h2></div><FileClock /></div>
        <form onSubmit={submitVersion}><FormGrid>
          <Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required disabled={!exerciseId} /></Field>
          <Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!exerciseId} /></Field>
          <Field label="Tipo"><select value={form.version_type} onChange={(e) => setForm({ ...form, version_type: e.target.value, source_version_id: "" })} disabled={!exerciseId || Boolean(editingId)}><option value="ORIGINAL">Original</option><option value="FORECAST">Forecast</option></select></Field>
          <Field label="N.º de versión"><input type="number" min="1" placeholder="Automático" value={form.version_number} onChange={(e) => setForm({ ...form, version_number: e.target.value })} disabled={!exerciseId || Boolean(editingId)} /></Field>
          <Field label="Periodo de referencia"><select value={form.period_id} onChange={(e) => setForm({ ...form, period_id: e.target.value })} disabled={!exerciseId}><option value="">Alcance anual</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.period_number}. {item.name}</option>)}</select></Field>
          <Field label="Responsable"><select value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })} disabled={!exerciseId}><option value="">Sin asignar</option>{responsibles.rows.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field>
          {form.version_type === "FORECAST" && <Field label="Original de origen" span={2}><select value={form.source_version_id} onChange={(e) => setForm({ ...form, source_version_id: e.target.value })} required disabled={!exerciseId || Boolean(editingId)}><option value="">Seleccione original aprobado</option>{originals.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>}
          <Field label="Observación" span={2}><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!exerciseId} /></Field>
        </FormGrid><div className="button-row"><button className="button button--primary" disabled={!exerciseId}>{editingId ? "Guardar cambios" : "Crear versión"}</button>{editingId && <button type="button" className="button button--secondary" onClick={() => { setEditingId(null); setForm(blankForm); }}>Cancelar</button>}</div></form>
      </section>

      <section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Catálogo</span><h2>Versiones del ejercicio</h2></div></div>
        <DataTable headers={["Versión", "Tipo", "Estado", "Origen", "Responsable", "Acciones"]} rows={rows.map((row) => [<><strong>{row.code}</strong><small>{row.name} · N.º {row.version_number}</small></>, row.version_type, <span className={`status-dot ${row.status === "BORRADOR" ? "status-dot--active" : ""}`}>{row.status}</span>, row.source_version_code ?? row.copied_from_code ?? "—", row.responsible_name ?? "—", <div className="table-actions">{row.status === "BORRADOR" && <><button className="button button--secondary button--compact" onClick={() => editVersion(row)}><Pencil size={13} /> Editar</button><button className="button button--secondary button--compact" onClick={() => startAction(row, "APROBAR")}><CheckCircle2 size={13} /> Aprobar</button></>}<button className="button button--secondary button--compact" onClick={() => startAction(row, "COPIAR")}><Copy size={13} /> Copiar</button>{row.status === "APROBADO" && <button className="button button--secondary button--compact" onClick={() => startAction(row, "CERRAR")}><LockKeyhole size={13} /> Cerrar</button>}{["APROBADO", "CERRADO"].includes(row.status) && <button className="button button--secondary button--compact" onClick={() => startAction(row, "REEMPLAZAR")}><Replace size={13} /> Reemplazar</button>}<button className="button button--secondary button--compact" onClick={() => startAction(row, "HISTORIAL")}>Historial</button></div>])} empty="No hay versiones para el ejercicio activo." />
      </section>
    </div>

    {selected && action && action !== "HISTORIAL" && <section className="panel panel--accent"><div className="panel__heading"><div><span className="eyebrow">Acción sobre {selected.code}</span><h2>{action === "COPIAR" ? "Copiar versión" : action === "REEMPLAZAR" ? "Marcar como reemplazada" : action === "APROBAR" ? "Aprobar versión" : "Cerrar versión"}</h2></div></div>
      <form onSubmit={submitAction}><FormGrid>
        {action === "COPIAR" && <><Field label="Nuevo código"><input value={actionForm.code} onChange={(e) => setActionForm({ ...actionForm, code: e.target.value.toUpperCase() })} required /></Field><Field label="Nuevo nombre"><input value={actionForm.name} onChange={(e) => setActionForm({ ...actionForm, name: e.target.value })} required /></Field></>}
        <Field label="Responsable" span={action === "COPIAR" ? 1 : 2}><select value={actionForm.responsible_id} onChange={(e) => setActionForm({ ...actionForm, responsible_id: e.target.value })} required={action !== "COPIAR"}><option value="">Seleccione</option>{responsibles.rows.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field>
        {action === "REEMPLAZAR" && <Field label="Versión sustituta" span={2}><select value={actionForm.replacement_version_id} onChange={(e) => setActionForm({ ...actionForm, replacement_version_id: e.target.value })} required><option value="">Seleccione</option>{rows.filter((item) => item.id !== selected.id && item.version_type === selected.version_type && ["APROBADO", "CERRADO"].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>}
        <Field label={action === "COPIAR" ? "Observación" : "Motivo u observación"} span={2}><textarea rows={3} value={actionForm.notes} onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })} required={action !== "COPIAR"} /></Field>
      </FormGrid><div className="button-row"><button className="button button--primary">Confirmar acción</button><button type="button" className="button button--secondary" onClick={() => { setSelected(null); setAction(null); }}>Cancelar</button></div></form>
    </section>}

    {selected && action === "HISTORIAL" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Trazabilidad</span><h2>Historial de {selected.code}</h2></div></div><DataTable headers={["Fecha", "Estado anterior", "Estado nuevo", "Responsable", "Observación"]} rows={history.map((row) => [new Date(row.created_at).toLocaleString("es-PE"), row.from_status ?? "Creación", row.to_status, row.responsible_name ?? "Sistema local", row.notes ?? "—"])} empty="No hay eventos registrados." /></section>}
  </div>;
}
