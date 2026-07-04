import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Download, FileCheck2, FileSpreadsheet, History, Upload } from "lucide-react";
import { apiRequest, postJson } from "../../lib/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Field, FormGrid, Message, Tabs } from "../../components/phase2/Ui";
import { ImportRowsTable } from "./ImportRowsTable";
import type { AnalysisResponse, ImportBatch, ImportTarget, InspectResponse, RealDataSource, SheetInspection } from "./types";

const officialReference = {
  company: "Corporación Aceros Arequipa S.A.",
  url: "https://investors.acerosarequipa.com/",
  period: "Memoria Integrada 2025 y portal corporativo",
  consulted: "2026-07-04",
};

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function downloadExcel(fileName: string, base64: string) {
  const anchor = document.createElement("a");
  anchor.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function ImportPage() {
  const { companyId, company, refreshCompanies } = useWorkspace();
  const [tab, setTab] = useState("Importar");
  const [targets, setTargets] = useState<ImportTarget[]>([]);
  const [targetKey, setTargetKey] = useState("sedes");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [sheets, setSheets] = useState<SheetInspection[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [sources, setSources] = useState<RealDataSource[]>([]);
  const [operatorName, setOperatorName] = useState("");
  const [sourceCompany, setSourceCompany] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePeriod, setSourcePeriod] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [transformations, setTransformations] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const target = useMemo(() => targets.find((item) => item.key === targetKey) ?? null, [targets, targetKey]);
  const sheet = useMemo(() => sheets.find((item) => item.name === sheetName) ?? null, [sheets, sheetName]);

  const loadAuxiliary = async () => {
    const suffix = companyId ? `?company_id=${companyId}` : "";
    const [catalogs, batches, sourceRows] = await Promise.all([
      apiRequest<ImportTarget[]>("/api/import/catalogs"),
      apiRequest<ImportBatch[]>(`/api/import/history${suffix}`),
      apiRequest<RealDataSource[]>("/api/import/sources"),
    ]);
    setTargets(catalogs);
    setHistory(batches);
    setSources(sourceRows);
  };

  useEffect(() => { void loadAuxiliary().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar el módulo.")); }, [companyId]);

  const clearResult = () => { setAnalysis(null); setSuccess(""); setError(""); };

  const suggestMapping = async (selectedTarget: string, selectedSheet: SheetInspection) => {
    const query = encodeURIComponent(selectedSheet.headers.join("|"));
    const result = await apiRequest<{ mapping: Record<string, string> }>(`/api/import/suggest/${selectedTarget}?headers=${query}`);
    setMapping(result.mapping);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    clearResult();
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) { setError("Solo se admiten archivos con extensión .xlsx."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("El archivo supera el límite de 20 MB."); return; }
    setBusy(true);
    try {
      const content = await readBase64(file);
      const result = await postJson<InspectResponse>("/api/import/inspect", { file_name: file.name, content_base64: content });
      setFileName(file.name);
      setFileContent(content);
      setSheets(result.sheets);
      const first = result.sheets[0];
      setSheetName(first?.name ?? "");
      if (first) await suggestMapping(targetKey, first);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible inspeccionar el archivo."); }
    finally { setBusy(false); }
  };

  const changeSheet = async (name: string) => {
    setSheetName(name); clearResult();
    const selected = sheets.find((item) => item.name === name);
    if (selected) {
      try { await suggestMapping(targetKey, selected); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo sugerir el mapeo."); }
    }
  };

  const changeTarget = async (key: string) => {
    setTargetKey(key); clearResult();
    if (sheet) {
      try { await suggestMapping(key, sheet); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo sugerir el mapeo."); }
    }
  };

  const analyze = async () => {
    if (!target || !sheet || !fileContent) { setError("Seleccione la tabla, el archivo y la hoja antes de analizar."); return; }
    if (target.companyScoped && !companyId) { setError("Seleccione una empresa en la barra superior."); return; }
    setBusy(true); clearResult();
    try {
      const result = await postJson<AnalysisResponse>("/api/import/analyze", {
        company_id: target.companyScoped ? companyId : null,
        target_table: target.key,
        file_name: fileName,
        content_base64: fileContent,
        sheet_name: sheet.name,
        header_row: sheet.header_row,
        mapping,
      });
      setAnalysis(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible analizar el archivo."); }
    finally { setBusy(false); }
  };

  const editRow = (rowIndex: number, key: string, value: string) => setAnalysis((current) => current ? ({ ...current, rows: current.rows.map((row, index) => index === rowIndex ? { ...row, values: { ...row.values, [key]: value } } : row) }) : current);
  const excludeRow = (rowIndex: number, excluded: boolean) => setAnalysis((current) => current ? ({ ...current, rows: current.rows.map((row, index) => index === rowIndex ? { ...row, excluded } : row) }) : current);

  const confirm = async () => {
    if (!analysis || !target || !sheet) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await postJson<{ message: string; created: number; updated: number; skipped: number }>("/api/import/confirm", {
        company_id: target.companyScoped ? companyId : null,
        target_table: target.key,
        file_name: fileName,
        sheet_name: sheet.name,
        operator_name: operatorName || null,
        source_company_name: sourceCompany || null,
        source_url: sourceUrl || null,
        source_period: sourcePeriod || null,
        source_consulted_at: sourceDate || null,
        transformations: transformations || null,
        update_existing: updateExisting,
        rows: analysis.rows.map((row) => ({ row_number: row.row_number, values: row.values, excluded: row.excluded })),
      });
      setSuccess(`${result.message} Creados: ${result.created}; actualizados: ${result.updated}; omitidos: ${result.skipped}.`);
      await loadAuxiliary();
      if (target.key === "empresas") await refreshCompanies();
      setTab("Historial y fuentes");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible confirmar la importación."); }
    finally { setBusy(false); }
  };

  const downloadTemplate = async () => {
    if (!target) return;
    try {
      const result = await apiRequest<{ file_name: string; content_base64: string }>(`/api/import/template/${target.key}`);
      downloadExcel(result.file_name, result.content_base64);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo descargar la plantilla."); }
  };

  const downloadErrors = async (id: number) => {
    try {
      const result = await apiRequest<{ file_name: string; content_base64: string }>(`/api/import/history/${id}/errors`);
      downloadExcel(result.file_name, result.content_base64);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo descargar el reporte."); }
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 4 · Importación flexible</span><h1>Importación de tablas maestras</h1><p>Inspeccione, mapee, valide, corrija o excluya filas antes de guardar en SQLite.</p></div><span className="status-pill status-pill--success"><FileSpreadsheet size={16} />Acceso directo sin login</span></section>
    <Tabs items={["Importar", "Historial y fuentes"]} active={tab} onChange={setTab} />
    {error && <Message type="danger">{error}</Message>}
    {success && <Message type="success">{success}</Message>}

    {tab === "Importar" ? <>
      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Paso 1</span><h2>Archivo y tabla destino</h2></div><Upload size={22} /></div>
        <FormGrid>
          <Field label="Tabla maestra"><select value={targetKey} onChange={(event) => void changeTarget(event.target.value)}>{targets.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></Field>
          <Field label="Empresa activa"><input value={target?.companyScoped ? (company?.commercial_name ?? "Seleccione una empresa arriba") : "Catálogo transversal"} readOnly /></Field>
          <Field label="Archivo .xlsx"><input type="file" accept=".xlsx" onChange={(event) => void handleFile(event)} /></Field>
          <Field label="Hoja"><select value={sheetName} disabled={!sheets.length} onChange={(event) => void changeSheet(event.target.value)}><option value="">Seleccione</option>{sheets.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.row_count} filas</option>)}</select></Field>
        </FormGrid>
        <div className="button-row"><button className="button button--ghost" onClick={() => void downloadTemplate()} disabled={!target}><Download size={16} />Descargar plantilla</button></div>
      </section>

      {target && sheet && <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Paso 2</span><h2>Mapeo de columnas</h2><p>Los encabezados equivalentes se detectan automáticamente; puede corregir cualquier asociación.</p></div></div>
        <div className="mapping-grid">{target.fields.map((field) => <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}><select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Sin mapear</option>{sheet.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></Field>)}</div>
        <div className="button-row"><button className="button button--primary" disabled={busy || !fileContent} onClick={() => void analyze()}><FileCheck2 size={16} />{busy ? "Analizando..." : "Analizar y validar"}</button></div>
      </section>}

      {analysis && <>
        <section className="metric-grid import-metrics"><Metric label="Filas leídas" value={analysis.summary.rows_read} /><Metric label="Válidas" value={analysis.summary.rows_valid} /><Metric label="Observadas" value={analysis.summary.rows_observed} /><Metric label="Rechazadas" value={analysis.summary.rows_rejected} /><Metric label="Duplicadas" value={analysis.summary.duplicates} /></section>
        <section className="panel">
          <div className="panel__heading"><div><span className="eyebrow">Paso 3</span><h2>Corrección o exclusión</h2><p>Edite las celdas o desmarque las filas que no deben importarse. La validación se ejecuta nuevamente al confirmar.</p></div></div>
          <ImportRowsTable fields={analysis.target.fields} rows={analysis.rows} onChange={editRow} onExclude={excludeRow} />
        </section>
        <section className="panel">
          <div className="panel__heading"><div><span className="eyebrow">Paso 4</span><h2>Trazabilidad y confirmación</h2></div><FileCheck2 size={22} /></div>
          <FormGrid>
            <Field label="Responsable u operador textual"><input value={operatorName} onChange={(event) => setOperatorName(event.target.value)} placeholder="Opcional" /></Field>
            <Field label="Empresa real de la fuente"><input value={sourceCompany} onChange={(event) => setSourceCompany(event.target.value)} placeholder="Opcional" /></Field>
            <Field label="Fuente pública"><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." /></Field>
            <Field label="Periodo de la fuente"><input value={sourcePeriod} onChange={(event) => setSourcePeriod(event.target.value)} placeholder="Ej. 2025" /></Field>
            <Field label="Fecha de consulta"><input type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} /></Field>
            <Field label="Transformaciones" span={2}><textarea value={transformations} onChange={(event) => setTransformations(event.target.value)} placeholder="Normalizaciones o conversiones realizadas, sin atribuir datos inventados." /></Field>
          </FormGrid>
          <div className="reference-box"><strong>Referencia oficial seleccionada para el trabajo:</strong><span>{officialReference.company} · {officialReference.period}</span><button className="button button--ghost" onClick={() => { setSourceCompany(officialReference.company); setSourceUrl(officialReference.url); setSourcePeriod(officialReference.period); setSourceDate(officialReference.consulted); }}>Usar referencia</button></div>
          <label className="check-line"><input type="checkbox" checked={updateExisting} onChange={(event) => setUpdateExisting(event.target.checked)} />Actualizar registros existentes; si se deja desmarcado, los duplicados válidos se omiten.</label>
          <div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void confirm()}><Upload size={16} />{busy ? "Guardando..." : "Confirmar importación"}</button></div>
        </section>
      </>}
    </> : <>
      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Trazabilidad</span><h2>Historial de importaciones</h2></div><History size={22} /></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Destino</th><th>Archivo</th><th>Estado</th><th>Leídas</th><th>Creadas</th><th>Actualizadas</th><th>Omitidas</th><th>Errores</th></tr></thead><tbody>{history.length ? history.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("es-PE")}</td><td>{row.target_table}</td><td>{row.file_name}<br /><span className="muted">{row.sheet_name}</span></td><td>{row.status}</td><td>{row.rows_read}</td><td>{row.rows_created}</td><td>{row.rows_updated}</td><td>{row.rows_skipped}</td><td><button className="button button--ghost" onClick={() => void downloadErrors(row.id)}>Excel</button></td></tr>) : <tr><td colSpan={9} className="table-empty">Aún no existen importaciones confirmadas.</td></tr>}</tbody></table></div>
      </section>
      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Información real</span><h2>Fuentes públicas documentadas</h2></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Empresa</th><th>Periodo</th><th>Consulta</th><th>Fuente</th><th>Transformaciones</th></tr></thead><tbody>{sources.length ? sources.map((source) => <tr key={source.id}><td>{source.company_name}</td><td>{source.source_period || "—"}</td><td>{source.consulted_at}</td><td>{source.source_url}</td><td>{source.transformations || source.notes || "Sin transformaciones."}</td></tr>) : <tr><td colSpan={5} className="table-empty">No hay fuentes documentadas.</td></tr>}</tbody></table></div>
      </section>
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="metric-card"><div><span>{label}</span><strong>{value}</strong></div></article>;
}
