import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Database, Download, FileSpreadsheet, Pencil, PlusCircle, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { DataTable, Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import type { DataKind, InspectResponse, InspectRow, MasterDataResponse, MasterRow } from "./types";

const blankRow = {
  center_code: "", center_name: "", element_code: "", element_name: "", account_code: "", account_name: "",
  account_nature: "GASTO", line_code: "", line_name: "", statement_section: "PRESUPUESTO", financial_item: "",
  cost_behavior: "NO_APLICA", cost_traceability: "NO_APLICA", quantity: "", unit_price: "", amount: "", source_reference: "", notes: "",
};

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.onload = () => { const result = String(reader.result ?? ""); resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result); };
    reader.readAsDataURL(file);
  });
}

function downloadBase64(fileName: string, base64: string) {
  const anchor = document.createElement("a");
  anchor.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  anchor.download = fileName;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
}

function contextQuery(values: { companyId: number; exerciseId: number; periodId: number; versionId: number; budgetTypeId: number }) {
  return `company_id=${values.companyId}&exercise_id=${values.exerciseId}&period_id=${values.periodId}&version_id=${values.versionId}&budget_type_id=${values.budgetTypeId}`;
}

export function MasterDataPage() {
  const { companyId, exerciseId, periodId, versionId, budgetTypeId, company, exercise, period, version, budgetType, refreshWorkflowStatus } = useWorkspace();
  const [tab, setTab] = useState("Registro manual");
  const [dataKind, setDataKind] = useState<DataKind>("PRESUPUESTADO");
  const [metadata, setMetadata] = useState({ source_label: "", source_url: "", source_period: "", operator_name: "", wacc_rate: "", notes: "" });
  const [rowForm, setRowForm] = useState(blankRow);
  const [editingRow, setEditingRow] = useState<MasterRow | null>(null);
  const [data, setData] = useState<MasterDataResponse>({ datasets: [], rows: [] });
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [inspection, setInspection] = useState<InspectResponse | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready = Boolean(companyId && exerciseId && periodId && versionId && budgetTypeId);

  const context = useMemo(() => ready ? { companyId: companyId!, exerciseId: exerciseId!, periodId: periodId!, versionId: versionId!, budgetTypeId: budgetTypeId! } : null, [ready, companyId, exerciseId, periodId, versionId, budgetTypeId]);

  const load = async () => {
    if (!context) { setData({ datasets: [], rows: [] }); return; }
    try { setData(await apiRequest<MasterDataResponse>(`/api/phase11/master-data?${contextQuery(context)}`)); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible cargar los datos maestros."); }
  };
  useEffect(() => { void load(); }, [companyId, exerciseId, periodId, versionId, budgetTypeId]);

  const payloadRow = (source = rowForm) => ({
    center_code: source.center_code || null, center_name: source.center_name || null, element_code: source.element_code || null, element_name: source.element_name || null,
    account_code: source.account_code || null, account_name: source.account_name || null, account_nature: source.account_nature || null,
    line_code: source.line_code || null, line_name: source.line_name, statement_section: source.statement_section || "PRESUPUESTO",
    financial_item: source.financial_item || null, cost_behavior: source.cost_behavior || "NO_APLICA", cost_traceability: source.cost_traceability || "NO_APLICA",
    quantity: source.quantity === "" ? null : Number(source.quantity), unit_price: source.unit_price === "" ? null : Number(source.unit_price), amount: Number(source.amount),
    source_reference: source.source_reference || null, notes: source.notes || null,
  });

  const basePayload = () => {
    if (!context) throw new Error("Complete empresa, periodo, versión y tipo de presupuesto.");
    return {
      company_id: context.companyId, exercise_id: context.exerciseId, period_id: context.periodId, version_id: context.versionId, budget_type_id: context.budgetTypeId,
      data_kind: dataKind, source_label: metadata.source_label || null, source_url: metadata.source_url || null, source_period: metadata.source_period || null,
      operator_name: metadata.operator_name || null, wacc_rate: metadata.wacc_rate === "" ? null : Number(metadata.wacc_rate), notes: metadata.notes || null,
    };
  };

  const saveManual = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await apiRequest("/api/phase11/master-data/import", { method: "POST", body: JSON.stringify({ ...basePayload(), source_file: null, replace_existing: false, rows: [payloadRow()] }) });
      setRowForm(blankRow); setMessage("Fila maestra registrada correctamente."); await load(); await refreshWorkflowStatus();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible registrar la fila."); }
    finally { setBusy(false); }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage(""); setInspection(null);
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Seleccione un archivo .xlsx.");
      const content = await readBase64(file); setFileName(file.name); setFileContent(content);
      const result = await apiRequest<InspectResponse>("/api/phase11/master-data/inspect", { method: "POST", body: JSON.stringify({ file_name: file.name, content_base64: content }) });
      setInspection(result); setSheetName(result.sheet_name); setSelectedRows(new Set(result.rows.filter((row) => row.warnings.length === 0).map((row) => row.row_number)));
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible inspeccionar el archivo."); }
    finally { setBusy(false); }
  };

  const changeSheet = async (name: string) => {
    if (!fileContent) return;
    setBusy(true); setMessage("");
    try {
      const result = await apiRequest<InspectResponse>("/api/phase11/master-data/inspect", { method: "POST", body: JSON.stringify({ file_name: fileName, content_base64: fileContent, sheet_name: name }) });
      setInspection(result); setSheetName(name); setSelectedRows(new Set(result.rows.filter((row) => row.warnings.length === 0).map((row) => row.row_number)));
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible cambiar de hoja."); }
    finally { setBusy(false); }
  };

  const importExcel = async () => {
    if (!inspection) return;
    setBusy(true); setMessage("");
    try {
      const rows = inspection.rows.filter((row) => selectedRows.has(row.row_number)).map(({ row_number: _rowNumber, warnings: _warnings, ...row }) => row);
      await apiRequest("/api/phase11/master-data/import", { method: "POST", body: JSON.stringify({ ...basePayload(), source_file: fileName, replace_existing: replaceExisting, rows }) });
      setInspection(null); setFileName(""); setFileContent(""); setMessage("Archivo registrado como información maestra del contexto activo.");
      await load(); await refreshWorkflowStatus(); setTab("Datos registrados");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible importar el archivo."); }
    finally { setBusy(false); }
  };

  const downloadTemplate = async () => {
    try { const result = await apiRequest<{ file_name: string; content_base64: string }>("/api/phase11/master-data/template"); downloadBase64(result.file_name, result.content_base64); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible descargar la plantilla."); }
  };

  const startEdit = (row: MasterRow) => {
    setEditingRow(row); setDataKind(row.data_kind);
    setRowForm({
      center_code: row.center_code ?? "", center_name: row.center_name ?? "", element_code: row.element_code ?? "", element_name: row.element_name ?? "",
      account_code: row.account_code ?? "", account_name: row.account_name ?? "", account_nature: row.account_nature ?? "GASTO",
      line_code: row.line_code ?? "", line_name: row.line_name, statement_section: row.statement_section ?? "PRESUPUESTO", financial_item: row.financial_item ?? "",
      cost_behavior: row.cost_behavior ?? "NO_APLICA", cost_traceability: row.cost_traceability ?? "NO_APLICA",
      quantity: row.quantity === null ? "" : String(row.quantity), unit_price: row.unit_price === null ? "" : String(row.unit_price), amount: String(row.amount),
      source_reference: row.source_reference ?? "", notes: row.notes ?? "",
    }); setTab("Datos registrados");
  };

  const updateRow = async (event: FormEvent) => {
    event.preventDefault(); if (!editingRow) return; setBusy(true); setMessage("");
    try { await apiRequest(`/api/phase11/master-data/rows/${editingRow.id}`, { method: "PATCH", body: JSON.stringify(payloadRow()) }); setEditingRow(null); setRowForm(blankRow); setMessage("Fila actualizada correctamente."); await load(); await refreshWorkflowStatus(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible actualizar la fila."); }
    finally { setBusy(false); }
  };

  const deleteRow = async (row: MasterRow) => {
    if (!window.confirm(`¿Eliminar la fila “${row.line_name}”?`)) return;
    setBusy(true); setMessage("");
    try { await apiRequest(`/api/phase11/master-data/rows/${row.id}`, { method: "DELETE" }); setMessage("Fila eliminada correctamente."); await load(); await refreshWorkflowStatus(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible eliminar la fila."); }
    finally { setBusy(false); }
  };

  const deleteDataset = async (id: number, label: string) => {
    if (!window.confirm(`¿Eliminar toda la información ${label.toLowerCase()} de este contexto?`)) return;
    setBusy(true); setMessage("");
    try { await apiRequest(`/api/phase11/master-data/datasets/${id}`, { method: "DELETE" }); setMessage("Registro maestro eliminado correctamente."); await load(); await refreshWorkflowStatus(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible eliminar el registro maestro."); }
    finally { setBusy(false); }
  };

  const rowFields = <FormGrid>
    <Field label="Código de centro"><input value={rowForm.center_code} onChange={(event) => setRowForm({ ...rowForm, center_code: event.target.value.toUpperCase() })} /></Field>
    <Field label="Nombre de centro"><input value={rowForm.center_name} onChange={(event) => setRowForm({ ...rowForm, center_name: event.target.value })} /></Field>
    <Field label="Código de elemento"><input value={rowForm.element_code} onChange={(event) => setRowForm({ ...rowForm, element_code: event.target.value.toUpperCase() })} /></Field>
    <Field label="Nombre de elemento"><input value={rowForm.element_name} onChange={(event) => setRowForm({ ...rowForm, element_name: event.target.value })} /></Field>
    <Field label="Código de cuenta"><input value={rowForm.account_code} onChange={(event) => setRowForm({ ...rowForm, account_code: event.target.value.toUpperCase() })} /></Field>
    <Field label="Nombre de cuenta"><input value={rowForm.account_name} onChange={(event) => setRowForm({ ...rowForm, account_name: event.target.value })} /></Field>
    <Field label="Naturaleza"><select value={rowForm.account_nature} onChange={(event) => setRowForm({ ...rowForm, account_nature: event.target.value })}>{["INGRESO","COSTO","GASTO","ACTIVO","PASIVO","PATRIMONIO"].map((value) => <option key={value}>{value}</option>)}</select></Field>
    <Field label="Código de línea"><input value={rowForm.line_code} onChange={(event) => setRowForm({ ...rowForm, line_code: event.target.value.toUpperCase() })} /></Field>
    <Field label="Nombre de línea" span={2}><input value={rowForm.line_name} onChange={(event) => setRowForm({ ...rowForm, line_name: event.target.value })} required /></Field>
    <Field label="Sección"><select value={rowForm.statement_section} onChange={(event) => setRowForm({ ...rowForm, statement_section: event.target.value })}>{["PRESUPUESTO","ESTADO_RESULTADOS","ESTADO_SITUACION","FLUJO_EFECTIVO"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
    <Field label="Partida financiera"><input value={rowForm.financial_item} onChange={(event) => setRowForm({ ...rowForm, financial_item: event.target.value.toUpperCase().replaceAll(" ", "_") })} placeholder="Ej. SALES o TOTAL_ASSETS" /></Field>
    <Field label="Comportamiento del costo"><select value={rowForm.cost_behavior} onChange={(event) => setRowForm({ ...rowForm, cost_behavior: event.target.value })}>{["NO_APLICA","FIJO","VARIABLE"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
    <Field label="Trazabilidad del costo"><select value={rowForm.cost_traceability} onChange={(event) => setRowForm({ ...rowForm, cost_traceability: event.target.value })}>{["NO_APLICA","DIRECTO","INDIRECTO"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
    <Field label="Cantidad"><input type="number" step="0.0001" value={rowForm.quantity} onChange={(event) => setRowForm({ ...rowForm, quantity: event.target.value })} /></Field>
    <Field label="Precio unitario"><input type="number" step="0.0001" value={rowForm.unit_price} onChange={(event) => setRowForm({ ...rowForm, unit_price: event.target.value })} /></Field>
    <Field label="Importe"><input type="number" step="0.01" value={rowForm.amount} onChange={(event) => setRowForm({ ...rowForm, amount: event.target.value })} required /></Field>
    <Field label="Fuente"><input value={rowForm.source_reference} onChange={(event) => setRowForm({ ...rowForm, source_reference: event.target.value })} /></Field>
    <Field label="Observación" span={2}><textarea rows={2} value={rowForm.notes} onChange={(event) => setRowForm({ ...rowForm, notes: event.target.value })} /></Field>
  </FormGrid>;

  return <div className="page-stack phase11-page">
    <section className="page-heading"><div><span className="eyebrow">Paso 4 · Fuente única del presupuesto maestro</span><h1>Tablas maestras</h1><p>Registre información presupuestada o real, manualmente o desde Excel. Cada conjunto es único por empresa, periodo, versión y tipo de presupuesto.</p></div><span className="status-pill status-pill--success"><Database size={16} /> Datos editables</span></section>
    {!ready && <Message type="danger">Complete primero empresa, ejercicio, periodo, versión y tipo de presupuesto. Las opciones posteriores permanecerán bloqueadas.</Message>}
    {message && <Message type={/correctamente|registrad|eliminad|importad/.test(message) ? "success" : "danger"}>{message}</Message>}
    {ready && <section className="panel phase11-context-summary"><div><strong>{company?.commercial_name}</strong><span>{exercise?.code} · {period?.name} · {version?.code} · {budgetType?.name}</span></div><div className="phase11-kind-switch"><button className={`button ${dataKind === "PRESUPUESTADO" ? "button--primary" : "button--secondary"}`} onClick={() => setDataKind("PRESUPUESTADO")}>Información presupuestada</button><button className={`button ${dataKind === "REAL" ? "button--primary" : "button--secondary"}`} onClick={() => setDataKind("REAL")}>Información real</button></div></section>}
    <Tabs items={["Registro manual", "Importar desde Excel", "Datos registrados"]} active={tab} onChange={setTab} />

    {tab === "Registro manual" && <div className="grid-2 grid-2--wide">
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Trazabilidad del conjunto</span><h2>{dataKind === "REAL" ? "Información real" : "Información presupuestada"}</h2></div><PlusCircle /></div><FormGrid>
        <Field label="Descripción de la fuente"><input disabled={!ready} value={metadata.source_label} onChange={(event) => setMetadata({ ...metadata, source_label: event.target.value })} /></Field>
        <Field label="Periodo de la fuente"><input disabled={!ready} value={metadata.source_period} onChange={(event) => setMetadata({ ...metadata, source_period: event.target.value })} /></Field>
        <Field label="Enlace o referencia"><input disabled={!ready} value={metadata.source_url} onChange={(event) => setMetadata({ ...metadata, source_url: event.target.value })} /></Field>
        <Field label="Responsable u operador"><input disabled={!ready} value={metadata.operator_name} onChange={(event) => setMetadata({ ...metadata, operator_name: event.target.value })} /></Field>
        <Field label="WACC para EVA (%)"><input disabled={!ready} type="number" min="0" max="100" step="0.01" value={metadata.wacc_rate} onChange={(event) => setMetadata({ ...metadata, wacc_rate: event.target.value })} /></Field>
        <Field label="Notas"><input disabled={!ready} value={metadata.notes} onChange={(event) => setMetadata({ ...metadata, notes: event.target.value })} /></Field>
      </FormGrid></section>
      <section className="panel panel--grow"><div className="panel__heading"><div><span className="eyebrow">Nueva partida</span><h2>Registro del presupuesto maestro</h2></div><Save /></div><form onSubmit={saveManual}>{rowFields}<button className="button button--primary" disabled={!ready || busy}><Save size={16} />Guardar partida</button></form></section>
    </div>}

    {tab === "Importar desde Excel" && <div className="page-stack">
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Archivo integrado</span><h2>Subir presupuesto o estado financiero</h2><p>Una misma plantilla admite presupuestos operativos, costos y estados financieros.</p></div><FileSpreadsheet /></div><FormGrid>
        <Field label="Archivo .xlsx"><input disabled={!ready} type="file" accept=".xlsx" onChange={(event) => void handleFile(event)} /></Field>
        <Field label="Hoja"><select disabled={!inspection} value={sheetName} onChange={(event) => void changeSheet(event.target.value)}><option value="">Seleccione</option>{inspection?.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.row_count} filas</option>)}</select></Field>
        <Field label="WACC para EVA (%)"><input disabled={!ready} type="number" min="0" max="100" step="0.01" value={metadata.wacc_rate} onChange={(event) => setMetadata({ ...metadata, wacc_rate: event.target.value })} /></Field>
        <Field label="Responsable u operador"><input disabled={!ready} value={metadata.operator_name} onChange={(event) => setMetadata({ ...metadata, operator_name: event.target.value })} /></Field>
        <Field label="Descripción de la fuente"><input disabled={!ready} value={metadata.source_label} onChange={(event) => setMetadata({ ...metadata, source_label: event.target.value })} /></Field>
        <Field label="Fuente pública o referencia"><input disabled={!ready} value={metadata.source_url} onChange={(event) => setMetadata({ ...metadata, source_url: event.target.value })} /></Field>
      </FormGrid><div className="button-row"><button className="button button--ghost" disabled={!ready} onClick={() => void downloadTemplate()}><Download size={16} />Descargar plantilla</button></div></section>
      {inspection && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Validación previa</span><h2>{inspection.summary.rows_valid} válidas de {inspection.summary.rows_read}</h2></div><Upload /></div>
        <DataTable headers={["Incluir", "Fila", "Centro", "Elemento", "Cuenta", "Partida", "Naturaleza", "Sección", "Importe", "Observaciones"]} rows={inspection.rows.map((row) => [<input key="include" type="checkbox" checked={selectedRows.has(row.row_number)} disabled={row.warnings.length > 0} onChange={(event) => setSelectedRows((current) => { const next = new Set(current); event.target.checked ? next.add(row.row_number) : next.delete(row.row_number); return next; })} />, row.row_number, row.center_code ?? "—", row.element_code ?? "—", row.account_code ?? "—", row.line_name, row.account_nature ?? "—", row.statement_section ?? "—", row.amount, row.warnings.join(" ") || "Válida"])} />
        <label className="check-line"><input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} />Sustituir la información {dataKind.toLowerCase()} que ya exista para esta combinación.</label>
        <button className="button button--primary" disabled={busy || selectedRows.size === 0} onClick={() => void importExcel()}><Upload size={16} />Registrar {selectedRows.size} filas</button>
      </section>}
    </div>}

    {tab === "Datos registrados" && <div className="page-stack">
      <section className="phase11-dataset-grid">{data.datasets.map((dataset) => <article className="panel phase11-dataset-card" key={dataset.id}><div><span className={`phase11-origin phase11-origin--${dataset.data_kind.toLowerCase()}`}>{dataset.data_kind}</span><h3>{dataset.budget_type_name}</h3><p>{dataset.row_count} filas · {Number(dataset.total_amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p><small>{dataset.source_file ?? dataset.source_label ?? "Registro manual"}</small></div><button className="button button--danger button--compact" disabled={busy} onClick={() => void deleteDataset(dataset.id, dataset.data_kind)}><Trash2 size={14} />Eliminar conjunto</button></article>)}</section>
      {editingRow && <section className="panel panel--accent"><div className="panel__heading"><div><span className="eyebrow">Edición</span><h2>{editingRow.line_name}</h2></div><Pencil /></div><form onSubmit={updateRow}>{rowFields}<div className="button-row"><button className="button button--primary" disabled={busy}><Save size={16} />Guardar cambios</button><button type="button" className="button button--secondary" onClick={() => { setEditingRow(null); setRowForm(blankRow); }}>Cancelar</button></div></form></section>}
      <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Partidas maestras</span><h2>Datos editables del contexto</h2></div><button className="button button--ghost" onClick={() => void load()}><RefreshCw size={15} />Actualizar</button></div>
        <DataTable headers={["Origen", "Centro", "Elemento", "Cuenta", "Partida", "Sección", "Clasificación", "Importe", "Fuente", "Acciones"]} rows={data.rows.map((row) => [<span key="kind" className={`phase11-origin phase11-origin--${row.data_kind.toLowerCase()}`}>{row.data_kind}</span>, `${row.center_code ?? "—"} ${row.center_name ?? ""}`, `${row.element_code ?? "—"} ${row.element_name ?? ""}`, `${row.account_code ?? "—"} ${row.account_name ?? ""}`, row.line_name, row.statement_section?.replaceAll("_", " ") ?? "PRESUPUESTO", `${row.account_nature ?? "—"} · ${row.cost_behavior ?? "—"} · ${row.cost_traceability ?? "—"}`, Number(row.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 }), row.source_reference ?? "—", <div key="actions" className="table-actions"><button className="button button--secondary button--compact" onClick={() => startEdit(row)}><Pencil size={13} />Editar</button><button className="button button--danger button--compact" onClick={() => void deleteRow(row)}><Trash2 size={13} />Eliminar</button></div>])} empty="No existe información maestra para el contexto activo." />
      </section>
    </div>}
  </div>;
}
