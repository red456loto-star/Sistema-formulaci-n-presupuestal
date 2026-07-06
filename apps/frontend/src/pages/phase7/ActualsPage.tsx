import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Plus, Save, Trash2, Upload } from "lucide-react";
import { apiRequest, API_BASE_URL, deleteRequest, patchJson, postJson } from "../../lib/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";
import type { OrganizationHierarchy } from "../phase5/types";
import type { ActualValue, BudgetType, ImportPreview, Responsible, SourceType } from "./types";
import "../../phase7-forecast.css";

const budgetTypes: Array<{ id: BudgetType; label: string }> = [
  { id: "PRESUPUESTO_ORIGINAL", label: "Presupuesto original" },
  { id: "VENTAS", label: "Ventas" },
  { id: "INVENTARIOS", label: "Inventarios" },
  { id: "COMPRAS", label: "Compras" },
  { id: "PRODUCCION", label: "Producción" },
  { id: "COSTOS", label: "Costos" },
  { id: "GASTOS", label: "Gastos" },
  { id: "INVERSIONES", label: "Inversiones" },
  { id: "RESULTADOS", label: "Resultados" },
  { id: "SITUACION_FINANCIERA", label: "Situación financiera" },
];
const sourceTypes: Array<{ id: SourceType; label: string }> = [
  { id: "REAL_PUBLICADO", label: "Dato real publicado" },
  { id: "REAL_INTERNO", label: "Dato real interno" },
  { id: "DERIVADO", label: "Dato transformado o derivado" },
  { id: "DEMOSTRATIVO", label: "Dato demostrativo" },
];

function money(value: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export function ActualsPage() {
  const { companyId, exerciseId, exercise, versions, periods } = useWorkspace();
  const originals = versions.filter((item) => item.version_type === "ORIGINAL");
  const [originalVersionId, setOriginalVersionId] = useState<number | null>(null);
  const [rows, setRows] = useState<ActualValue[]>([]);
  const [hierarchy, setHierarchy] = useState<OrganizationHierarchy | null>(null);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState("Registro manual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [operatorText, setOperatorText] = useState("");
  const [form, setForm] = useState({
    period_id: "", center_id: "", account_id: "", budget_type: "PRESUPUESTO_ORIGINAL" as BudgetType,
    budgeted_value: "", actual_value: "", source_type: "REAL_INTERNO" as SourceType,
    source_reference: "", source_period: "", source_date: "", responsible_id: "", comment: "",
  });

  useEffect(() => {
    setOriginalVersionId((current) => originals.some((item) => item.id === current) ? current : (originals[0]?.id ?? null));
  }, [companyId, exerciseId, versions.length]);

  const centers = useMemo(() => hierarchy?.organizational.flatMap((site) => site.centers) ?? [], [hierarchy]);
  const selectedCenter = centers.find((item) => item.id === Number(form.center_id));
  const accounts = selectedCenter
    ? selectedCenter.budget.flatMap((group) => group.elements.flatMap((element) => element.accounts))
    : hierarchy?.budget.flatMap((group) => group.elements.flatMap((element) => element.accounts)) ?? [];

  const load = async () => {
    if (!companyId || !exerciseId || !originalVersionId) { setRows([]); return; }
    const [actualRows, organization, responsibleRows] = await Promise.all([
      apiRequest<ActualValue[]>(`/api/actuals?company_id=${companyId}&exercise_id=${exerciseId}&original_version_id=${originalVersionId}`),
      apiRequest<OrganizationHierarchy>(`/api/organization/hierarchy?company_id=${companyId}`),
      apiRequest<Responsible[]>(`/api/catalog/responsables?company_id=${companyId}`),
    ]);
    setRows(actualRows);
    setHierarchy(organization);
    setResponsibles(responsibleRows.filter((item) => item.active));
    setForm((current) => ({
      ...current,
      period_id: current.period_id || String(periods.find((item) => item.status === "ABIERTO")?.id ?? periods[0]?.id ?? ""),
      center_id: current.center_id || String(organization.organizational[0]?.centers[0]?.id ?? ""),
    }));
  };

  useEffect(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar la información real.")); }, [companyId, exerciseId, originalVersionId]);

  const reset = () => {
    setSelectedId(null);
    setForm((current) => ({ ...current, account_id: "", budgeted_value: "", actual_value: "", source_reference: "", source_period: "", source_date: "", comment: "" }));
  };

  const edit = (row: ActualValue) => {
    setSelectedId(row.id);
    setForm({
      period_id: String(row.period_id), center_id: String(row.center_id), account_id: String(row.account_id), budget_type: row.budget_type,
      budgeted_value: String(row.budgeted_value), actual_value: String(row.actual_value), source_type: row.source_type,
      source_reference: row.source_reference, source_period: row.source_period ?? "", source_date: row.source_date ?? "",
      responsible_id: row.responsible_id ? String(row.responsible_id) : "", comment: row.comment ?? "",
    });
    setTab("Registro manual");
  };

  const save = async () => {
    if (!companyId || !exerciseId || !originalVersionId) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      if (!form.period_id || !form.center_id || !form.account_id || !form.actual_value || !form.source_reference.trim()) {
        throw new Error("Complete periodo, centro, cuenta, valor real y fuente.");
      }
      const payload = {
        company_id: companyId, exercise_id: exerciseId, original_version_id: originalVersionId,
        period_id: Number(form.period_id), center_id: Number(form.center_id), account_id: Number(form.account_id),
        budget_type: form.budget_type, budgeted_value: form.budgeted_value === "" ? undefined : Number(form.budgeted_value),
        actual_value: Number(form.actual_value), source_type: form.source_type, source_reference: form.source_reference,
        source_period: form.source_period || null, source_date: form.source_date || null,
        responsible_id: form.responsible_id ? Number(form.responsible_id) : null, comment: form.comment || null,
      };
      const result = selectedId
        ? await patchJson<{ message: string }>(`/api/actuals/${selectedId}`, payload)
        : await postJson<{ message: string }>("/api/actuals", payload);
      setSuccess(result.message); reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar el dato real."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!selectedId || !window.confirm("¿Eliminar el dato real seleccionado?")) return;
    setBusy(true); setError("");
    try { const result = await deleteRequest<{ message: string }>(`/api/actuals/${selectedId}`); setSuccess(result.message); reset(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible eliminar el dato real."); }
    finally { setBusy(false); }
  };

  const inspect = async () => {
    if (!companyId || !exerciseId || !originalVersionId || !file) throw new Error("Seleccione un archivo .xlsx.");
    const content = await fileToBase64(file);
    setPreview(await postJson<ImportPreview>("/api/actuals/import/inspect", {
      company_id: companyId, exercise_id: exerciseId, original_version_id: originalVersionId,
      file_name: file.name, content_base64: content,
    }));
  };

  const confirmImport = async () => {
    if (!companyId || !exerciseId || !originalVersionId || !file || !preview) return;
    const validRows = preview.rows.filter((row) => row.status === "VALIDO").map(({ row_number, status, errors, period_label, center_label, account_label, ...row }) => row);
    if (!validRows.length) throw new Error("No existen filas válidas para importar.");
    const result = await postJson<{ message: string }>("/api/actuals/import/confirm", {
      company_id: companyId, exercise_id: exerciseId, original_version_id: originalVersionId,
      file_name: file.name, sheet_name: preview.sheet_name, operator_text: operatorText || null, rows: validRows,
    });
    setSuccess(result.message); setPreview(null); setFile(null); await load();
  };

  const runImport = async (task: () => Promise<void>) => {
    setBusy(true); setError(""); setSuccess("");
    try { await task(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible procesar el archivo."); }
    finally { setBusy(false); }
  };

  const downloadTemplate = () => { window.location.href = `${API_BASE_URL}/api/actuals/template`; };
  const annualBudget = rows.reduce((sum, row) => sum + row.budgeted_value, 0);
  const annualActual = rows.reduce((sum, row) => sum + row.actual_value, 0);

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 7 · Información real</span><h1>Registro e importación de ejecución real</h1><p>Los datos quedan vinculados a la empresa, ejercicio, versión original, periodo, centro, cuenta, tipo de presupuesto y fuente.</p></div><FileSpreadsheet size={28} /></section>
    {error && <Message type="danger">{error}</Message>}{success && <Message type="success">{success}</Message>}
    {!companyId || !exerciseId ? <Message>Seleccione empresa y ejercicio en la barra superior.</Message> : null}
    {companyId && exerciseId && <>
      <section className="panel"><FormGrid><Field label="Versión original"><select value={originalVersionId ?? ""} onChange={(event) => setOriginalVersionId(event.target.value ? Number(event.target.value) : null)}><option value="">Seleccione</option>{originals.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.status}</option>)}</select></Field></FormGrid></section>
      {originalVersionId && <>
        <section className="metric-grid phase7-summary"><Metric label="Registros" value={String(rows.length)} /><Metric label="Presupuestado comparable" value={money(annualBudget, exercise?.currency_code)} /><Metric label="Real registrado" value={money(annualActual, exercise?.currency_code)} /><Metric label="Diferencia" value={money(annualActual - annualBudget, exercise?.currency_code)} /></section>
        <Tabs items={["Registro manual", "Importación Excel"]} active={tab} onChange={setTab} />
        {tab === "Registro manual" ? <section className="panel">
          <div className="panel__heading"><div><span className="eyebrow">Captura</span><h2>{selectedId ? "Editar dato real" : "Nuevo dato real"}</h2></div><button className="button button--ghost" onClick={reset}><Plus size={16} />Nuevo</button></div>
          <FormGrid>
            <Field label="Periodo"><select value={form.period_id} onChange={(event) => setForm((current) => ({ ...current, period_id: event.target.value }))}><option value="">Seleccione</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.period_number} · {item.name}{item.status === "CERRADO" ? " (cerrado)" : ""}</option>)}</select></Field>
            <Field label="Centro"><select value={form.center_id} onChange={(event) => setForm((current) => ({ ...current, center_id: event.target.value, account_id: "" }))}><option value="">Seleccione</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
            <Field label="Cuenta"><select value={form.account_id} onChange={(event) => setForm((current) => ({ ...current, account_id: event.target.value }))}><option value="">Seleccione</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
            <Field label="Tipo de presupuesto"><select value={form.budget_type} onChange={(event) => setForm((current) => ({ ...current, budget_type: event.target.value as BudgetType }))}>{budgetTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Presupuestado"><input type="number" step="0.01" value={form.budgeted_value} placeholder={form.budget_type === "PRESUPUESTO_ORIGINAL" ? "Se deriva automáticamente" : "Obligatorio"} onChange={(event) => setForm((current) => ({ ...current, budgeted_value: event.target.value }))} /></Field>
            <Field label="Valor real"><input type="number" step="0.01" value={form.actual_value} onChange={(event) => setForm((current) => ({ ...current, actual_value: event.target.value }))} /></Field>
            <Field label="Clasificación de la fuente"><select value={form.source_type} onChange={(event) => setForm((current) => ({ ...current, source_type: event.target.value as SourceType }))}>{sourceTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Fuente o referencia" span={2}><input value={form.source_reference} onChange={(event) => setForm((current) => ({ ...current, source_reference: event.target.value }))} placeholder="Documento, URL, reporte contable o referencia pública" /></Field>
            <Field label="Periodo de la fuente"><input value={form.source_period} onChange={(event) => setForm((current) => ({ ...current, source_period: event.target.value }))} placeholder="2026-01" /></Field>
            <Field label="Fecha de la fuente"><input type="date" value={form.source_date} onChange={(event) => setForm((current) => ({ ...current, source_date: event.target.value }))} /></Field>
            <Field label="Responsable"><select value={form.responsible_id} onChange={(event) => setForm((current) => ({ ...current, responsible_id: event.target.value }))}><option value="">Sin asignar</option>{responsibles.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.position}</option>)}</select></Field>
            <Field label="Comentario" span={2}><textarea value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} /></Field>
          </FormGrid><div className="button-row">{selectedId && <button className="button button--ghost" disabled={busy} onClick={() => void remove()}><Trash2 size={16} />Eliminar</button>}<button className="button button--primary" disabled={busy} onClick={() => void save()}><Save size={16} />{selectedId ? "Actualizar" : "Guardar"}</button></div>
        </section> : <section className="panel">
          <div className="panel__heading"><div><span className="eyebrow">Carga masiva</span><h2>Importar información real desde Excel</h2><p>Se importan únicamente filas válidas y cada fila conserva su fuente.</p></div><button className="button button--ghost" onClick={downloadTemplate}><Download size={16} />Descargar plantilla</button></div>
          <FormGrid><Field label="Archivo .xlsx" span={2}><input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} /></Field><Field label="Operador textual"><input value={operatorText} onChange={(event) => setOperatorText(event.target.value)} placeholder="Nombre de quien realiza la carga" /></Field></FormGrid>
          <div className="button-row"><button className="button button--primary" disabled={busy || !file} onClick={() => void runImport(inspect)}><Upload size={16} />Analizar archivo</button>{preview && <button className="button button--primary" disabled={busy || preview.summary.rows_valid === 0} onClick={() => void runImport(confirmImport)}>Confirmar {preview.summary.rows_valid} filas válidas</button>}</div>
          {preview && <><div className="metric-grid phase7-summary"><Metric label="Filas leídas" value={String(preview.summary.rows_read)} /><Metric label="Válidas" value={String(preview.summary.rows_valid)} /><Metric label="Rechazadas" value={String(preview.summary.rows_rejected)} /></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Fila</th><th>Estado</th><th>Periodo</th><th>Centro</th><th>Cuenta</th><th>Real</th><th>Fuente</th><th>Errores</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row_number}><td>{row.row_number}</td><td>{row.status}</td><td>{row.period_label}</td><td>{row.center_label}</td><td>{row.account_label}</td><td>{row.actual_value ?? "—"}</td><td>{row.source_reference}</td><td>{row.errors.join("; ") || "—"}</td></tr>)}</tbody></table></div></>}
        </section>}
        <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Trazabilidad</span><h2>Información real registrada</h2></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Periodo</th><th>Centro / cuenta</th><th>Tipo</th><th>Presupuestado</th><th>Real</th><th>Diferencia</th><th>Fuente</th><th></th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td>{row.period_number} · {row.period_name}</td><td>{row.center_code} · {row.account_code}<br /><span className="muted">{row.group_code} / {row.element_code}</span></td><td>{row.budget_type}</td><td>{money(row.budgeted_value, exercise?.currency_code)}</td><td>{money(row.actual_value, exercise?.currency_code)}</td><td>{money(row.variance, exercise?.currency_code)}</td><td>{row.source_type}<br /><span className="muted">{row.source_reference}</span></td><td><button className="button button--ghost" onClick={() => edit(row)}>Abrir</button></td></tr>) : <tr><td colSpan={8} className="table-empty">No existen datos reales para la versión seleccionada.</td></tr>}</tbody></table></div></section>
      </>}
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><div><span>{label}</span><strong>{value}</strong></div></article>; }
