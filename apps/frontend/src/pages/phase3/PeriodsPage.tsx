import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, CalendarRange, Pencil, RotateCcw, ShieldCheck } from "lucide-react";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";
import { apiRequest, deleteRequest, patchJson, postJson } from "../../lib/api";
import { useCatalog } from "../../lib/useCatalog";
import { useWorkspace, type BudgetExercise } from "../../context/WorkspaceContext";

type Currency = { id: number; code: string; name: string; active: number };
type Responsible = { id: number; full_name: string; position: string; active: number };
type ProjectionYear = { id: number; sequence: number; year: number; description: string; active: number };
type PeriodDetail = {
  id: number; period_number: number; name: string; start_date: string; end_date: string; status: "ABIERTO" | "CERRADO";
  closed_at?: string | null; closed_responsible_name?: string | null; close_notes?: string | null;
};

const emptyExercise = { code: "", budget_year: String(new Date().getFullYear() + 1), currency_id: "", notes: "", active: true };

export function PeriodsPage() {
  const [tab, setTab] = useState("Ejercicios");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [exerciseForm, setExerciseForm] = useState(emptyExercise);
  const [projections, setProjections] = useState<ProjectionYear[]>([]);
  const [periodAction, setPeriodAction] = useState({ period_id: "", responsible_id: "", notes: "" });
  const {
    companyId, exerciseId, setExerciseId, exercises, periods,
    refreshExercises, refreshPeriods, refreshVersions,
  } = useWorkspace();
  const currencies = useCatalog<Currency>("monedas");
  const responsibles = useCatalog<Responsible>("responsables", companyId);

  useEffect(() => {
    if (!companyId || !exerciseId) { setProjections([]); return; }
    void apiRequest<ProjectionYear[]>(`/api/catalog/proyecciones?company_id=${companyId}&exercise_id=${exerciseId}`)
      .then(setProjections).catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [companyId, exerciseId]);

  const run = async (action: () => Promise<void>, success: string) => {
    setMessage("");
    try { await action(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const resetExercise = () => { setEditingId(null); setExerciseForm(emptyExercise); };
  const editExercise = (row: BudgetExercise) => {
    setEditingId(row.id);
    setExerciseForm({ code: row.code, budget_year: String(row.budget_year), currency_id: String(row.currency_id), notes: row.notes ?? "", active: Boolean(row.active) });
    setTab("Ejercicios");
  };

  const submitExercise = (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) { setMessage("Seleccione una empresa para crear el ejercicio."); return; }
    void run(async () => {
      const payload = {
        company_id: companyId,
        code: exerciseForm.code,
        budget_year: Number(exerciseForm.budget_year),
        currency_id: Number(exerciseForm.currency_id),
        notes: exerciseForm.notes || null,
        active: exerciseForm.active,
      };
      if (editingId) await patchJson(`/api/catalog/ejercicios/${editingId}`, payload);
      else {
        const created = await postJson<{ id: number }>("/api/catalog/ejercicios", payload);
        setExerciseId(created.id);
      }
      await refreshExercises();
      await refreshPeriods();
      await refreshVersions();
      resetExercise();
    }, editingId ? "Ejercicio actualizado correctamente." : "Ejercicio creado con 12 periodos y 3 años proyectados.");
  };

  const selectedPeriod = periods.find((item) => item.id === Number(periodAction.period_id)) as PeriodDetail | undefined;
  const submitPeriodAction = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPeriod) { setMessage("Seleccione un periodo."); return; }
    const action = selectedPeriod.status === "ABIERTO" ? "cerrar" : "reabrir";
    void run(async () => {
      await postJson(`/api/catalog/periodos/${selectedPeriod.id}/${action}`, {
        responsible_id: Number(periodAction.responsible_id), notes: periodAction.notes,
      });
      await refreshPeriods();
      setPeriodAction({ period_id: "", responsible_id: "", notes: "" });
    }, selectedPeriod.status === "ABIERTO" ? "Periodo cerrado correctamente." : "Periodo reabierto correctamente.");
  };

  const deactivateExercise = (id: number) => void run(async () => {
    await deleteRequest(`/api/catalog/ejercicios/${id}`);
    await refreshExercises();
  }, "Ejercicio desactivado correctamente.");

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 3 · Base temporal</span><h1>Ejercicios, periodos y proyección</h1><p>Administra años presupuestales, los doce periodos mensuales y los tres años posteriores de proyección, sin registrar importes.</p></div><span className="status-pill status-pill--success"><CalendarRange size={16} /> Contexto activo</span></section>
    {!companyId && <Message type="danger">Seleccione una empresa en la barra superior para continuar.</Message>}
    {message && <Message type={message.includes("correctamente") || message.includes("creado") ? "success" : "danger"}>{message}</Message>}
    <Tabs items={["Ejercicios", "Periodos", "Proyección"]} active={tab} onChange={setTab} />

    {tab === "Ejercicios" && <div className="grid-2 grid-2--wide">
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">{editingId ? "Edición" : "Nuevo registro"}</span><h2>{editingId ? "Actualizar ejercicio" : "Crear ejercicio anual"}</h2></div><CalendarDays /></div>
        <form onSubmit={submitExercise}><FormGrid>
          <Field label="Código"><input value={exerciseForm.code} onChange={(e) => setExerciseForm({ ...exerciseForm, code: e.target.value.toUpperCase() })} required disabled={!companyId} /></Field>
          <Field label="Año presupuestado"><input type="number" min="2000" max="2200" value={exerciseForm.budget_year} onChange={(e) => setExerciseForm({ ...exerciseForm, budget_year: e.target.value })} required disabled={!companyId || Boolean(editingId)} /></Field>
          <Field label="Moneda" span={2}><select value={exerciseForm.currency_id} onChange={(e) => setExerciseForm({ ...exerciseForm, currency_id: e.target.value })} required disabled={!companyId}><option value="">Seleccione</option>{currencies.rows.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
          <Field label="Observación" span={2}><textarea rows={3} value={exerciseForm.notes} onChange={(e) => setExerciseForm({ ...exerciseForm, notes: e.target.value })} disabled={!companyId} /></Field>
          <Field label="Estado" span={2}><select value={exerciseForm.active ? "1" : "0"} onChange={(e) => setExerciseForm({ ...exerciseForm, active: e.target.value === "1" })} disabled={!companyId}><option value="1">Activo</option><option value="0">Inactivo</option></select></Field>
        </FormGrid><div className="button-row"><button className="button button--primary" disabled={!companyId}>{editingId ? "Guardar cambios" : "Crear ejercicio"}</button>{editingId && <button type="button" className="button button--secondary" onClick={resetExercise}>Cancelar</button>}</div></form>
      </section>
      <section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Catálogo</span><h2>Ejercicios registrados</h2></div></div>
        <DataTable headers={["Código", "Año", "Moneda", "Fechas", "Estado", "Acciones"]} rows={exercises.map((row) => [<strong>{row.code}</strong>, row.budget_year, row.currency_code ?? row.currency_id, <><small>{row.start_date}</small><small>{row.end_date}</small></>, <span className={`status-dot ${row.active ? "status-dot--active" : ""}`}>{row.active ? "Activo" : "Inactivo"}</span>, <div className="table-actions"><button className="button button--secondary button--compact" onClick={() => editExercise(row)}><Pencil size={14} /> Editar</button>{row.active ? <button className="button button--danger button--compact" onClick={() => deactivateExercise(row.id)}>Desactivar</button> : null}</div>])} empty="No hay ejercicios para la empresa activa." />
      </section>
    </div>}

    {tab === "Periodos" && <div className="grid-2 grid-2--wide">
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Control mensual</span><h2>Cerrar o reabrir periodo</h2></div><ShieldCheck /></div>
        {!exerciseId ? <Message>Seleccione un ejercicio en la barra superior.</Message> : <form onSubmit={submitPeriodAction}><FormGrid>
          <Field label="Periodo" span={2}><select value={periodAction.period_id} onChange={(e) => setPeriodAction({ ...periodAction, period_id: e.target.value })} required><option value="">Seleccione</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.period_number}. {item.name} · {item.status}</option>)}</select></Field>
          <Field label="Responsable" span={2}><select value={periodAction.responsible_id} onChange={(e) => setPeriodAction({ ...periodAction, responsible_id: e.target.value })} required><option value="">Seleccione</option>{responsibles.rows.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field>
          <Field label={selectedPeriod?.status === "CERRADO" ? "Motivo de reapertura" : "Observación de cierre"} span={2}><textarea rows={3} value={periodAction.notes} onChange={(e) => setPeriodAction({ ...periodAction, notes: e.target.value })} required /></Field>
        </FormGrid><button className="button button--primary" disabled={!selectedPeriod}>{selectedPeriod?.status === "CERRADO" ? <><RotateCcw size={16} /> Reabrir periodo</> : "Cerrar periodo"}</button></form>}
      </section>
      <section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Doce meses</span><h2>Periodos del ejercicio</h2></div></div>
        <DataTable headers={["N.º", "Periodo", "Inicio", "Fin", "Estado", "Último cierre"]} rows={(periods as PeriodDetail[]).map((row) => [String(row.period_number).padStart(2, "0"), row.name, row.start_date, row.end_date, <span className={`status-dot ${row.status === "ABIERTO" ? "status-dot--active" : ""}`}>{row.status}</span>, row.closed_at ? <><small>{new Date(row.closed_at).toLocaleString("es-PE")}</small><small>{row.closed_responsible_name ?? "Responsable registrado"}</small></> : "—"])} empty="Seleccione un ejercicio para consultar sus periodos." />
      </section>
    </div>}

    {tab === "Proyección" && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Horizonte presupuestal</span><h2>Tres años posteriores</h2></div><CalendarRange /></div>
      <DataTable headers={["Orden", "Año", "Descripción", "Estado"]} rows={projections.map((row) => [row.sequence, row.year, row.description, row.active ? "Activo" : "Inactivo"])} empty="Seleccione un ejercicio para consultar sus años proyectados." />
    </section>}
  </div>;
}
