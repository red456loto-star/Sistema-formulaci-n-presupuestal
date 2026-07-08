import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Download, Printer, RefreshCw } from "lucide-react";
import { DataTable, Message } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import { formatReportValue } from "../phase10/utils";
import type { MasterDataResponse, MasterRow } from "./types";

type ComponentKey = "ventas" | "inventarios" | "compras" | "produccion" | "costos" | "gastos" | "inversion" | "estado_resultados" | "estado_situacion";

const components: Array<{ key: ComponentKey; title: string; description: string; matcher: (row: MasterRow) => boolean }> = [
  { key: "ventas", title: "Presupuesto de ventas", description: "Ingresos, volúmenes, precios y partidas comerciales presupuestadas.", matcher: (row) => has(row, ["SALES", "VENTA", "INGRESO"]) || row.account_nature === "INGRESO" },
  { key: "inventarios", title: "Presupuesto de inventarios", description: "Existencias, inventario inicial, final y partidas de almacén.", matcher: (row) => has(row, ["INVENTORY", "INVENTARIO", "EXISTENCIA", "ALMACEN"]) },
  { key: "compras", title: "Presupuesto de compras", description: "Compras de materiales, mercaderías, insumos o servicios presupuestados.", matcher: (row) => has(row, ["COMPRA", "PURCHASE", "ADQUISICION", "MATERIAL", "INSUMO"]) },
  { key: "produccion", title: "Presupuesto de producción", description: "Unidades, procesos productivos y partidas asociadas a producción.", matcher: (row) => has(row, ["PRODUCCION", "PRODUCTION", "FABRICACION", "UNIDADES PRODUCIDAS"]) },
  { key: "costos", title: "Presupuesto de costos por centro productivo", description: "Costos directos e indirectos por centro de actividad productivo.", matcher: (row) => row.account_nature === "COSTO" || row.cost_traceability === "DIRECTO" || row.cost_traceability === "INDIRECTO" || row.cost_behavior === "VARIABLE" },
  { key: "gastos", title: "Presupuesto de gastos por centro de actividad", description: "Gastos operativos, administrativos, comerciales y de soporte por centro.", matcher: (row) => row.account_nature === "GASTO" || has(row, ["GASTO", "EXPENSE", "OPERATING_EXPENSES"]) },
  { key: "inversion", title: "Presupuesto de inversión", description: "Activos, CAPEX, proyectos, maquinaria, equipos e inversiones.", matcher: (row) => has(row, ["INVERSION", "INVERSIÓN", "CAPEX", "ACTIVO FIJO", "NONCURRENT_ASSETS"]) },
  { key: "estado_resultados", title: "Estado de resultados presupuestado", description: "Ingresos, costos, gastos y resultado neto presupuestado.", matcher: (row) => row.statement_section === "ESTADO_RESULTADOS" || has(row, ["NET_INCOME", "OPERATING_INCOME", "COST_OF_SALES", "PRE_TAX_INCOME"]) },
  { key: "estado_situacion", title: "Estado de situación financiera presupuestado", description: "Activos, pasivos y patrimonio presupuestados.", matcher: (row) => row.statement_section === "ESTADO_SITUACION" || ["ACTIVO", "PASIVO", "PATRIMONIO"].includes(String(row.account_nature)) },
];

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}
function has(row: MasterRow, words: string[]) {
  const text = normalize([row.line_code, row.line_name, row.account_name, row.financial_item, row.statement_section, row.notes].filter(Boolean).join(" "));
  return words.some((word) => text.includes(normalize(word)));
}
function contextQuery(values: { companyId: number; exerciseId: number; periodId: number; versionId: number; budgetTypeId: number }) {
  return `company_id=${values.companyId}&exercise_id=${values.exerciseId}&period_id=${values.periodId}&version_id=${values.versionId}&budget_type_id=${values.budgetTypeId}`;
}
function exportCsv(name: string, rows: MasterRow[]) {
  const headers = ["origen", "centro", "elemento", "cuenta", "partida", "seccion", "naturaleza", "importe"];
  const lines = [headers.join(";")].concat(rows.map((row) => [row.data_kind, row.center_name ?? "", row.element_name ?? "", row.account_name ?? "", row.line_name, row.statement_section ?? "", row.account_nature ?? "", String(row.amount).replace(".", ",")].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob); anchor.download = name; document.body.appendChild(anchor); anchor.click(); URL.revokeObjectURL(anchor.href); anchor.remove();
}

export function MasterBudgetPage() {
  const { companyId, exerciseId, periodId, versionId, budgetTypeId, company, exercise, period, version, budgetType } = useWorkspace();
  const [data, setData] = useState<MasterDataResponse>({ datasets: [], rows: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = Boolean(companyId && exerciseId && periodId && versionId && budgetTypeId);
  const context = useMemo(() => ready ? { companyId: companyId!, exerciseId: exerciseId!, periodId: periodId!, versionId: versionId!, budgetTypeId: budgetTypeId! } : null, [ready, companyId, exerciseId, periodId, versionId, budgetTypeId]);

  const load = async () => {
    if (!context) { setData({ datasets: [], rows: [] }); return; }
    setBusy(true); setError("");
    try { setData(await apiRequest<MasterDataResponse>(`/api/phase11/master-data?${contextQuery(context)}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible cargar el presupuesto maestro."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [companyId, exerciseId, periodId, versionId, budgetTypeId]);

  const budgetedRows = data.rows.filter((row) => row.data_kind === "PRESUPUESTADO");
  const sections = components.map((component) => {
    const rows = budgetedRows.filter(component.matcher);
    const total = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return { ...component, rows, total };
  });
  const unclassified = budgetedRows.filter((row) => !components.some((component) => component.matcher(row)));
  const totalBudget = budgetedRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return <div className="page-stack phase11-page phase11-master-budget">
    <section className="page-heading phase11-no-print"><div><span className="eyebrow">Presupuesto maestro</span><h1>Presupuesto maestro</h1><p>Vista integrada de ventas, inventarios, compras, producción, costos, gastos, inversión y estados financieros presupuestados. Se alimenta automáticamente desde Tablas maestras.</p></div><div className="button-row"><button className="button button--ghost" disabled={!budgetedRows.length} onClick={() => window.print()}><Printer size={16} />Imprimir</button><button className="button button--ghost" disabled={!budgetedRows.length} onClick={() => exportCsv("presupuesto-maestro.csv", budgetedRows)}><Download size={16} />CSV</button><button className="button button--primary" disabled={busy} onClick={() => void load()}><RefreshCw size={16} />Actualizar</button></div></section>
    {error && <Message type="danger">{error}</Message>}
    {!budgetedRows.length && <Message type="danger">Suba información presupuestada en Tablas maestras para visualizar el presupuesto maestro.</Message>}
    <section className="panel phase11-report-context"><div><ClipboardList size={24} /><div><span className="eyebrow">{company?.commercial_name ?? "Empresa"}</span><h2>{budgetType?.name ?? "Tipo de presupuesto"}</h2><p>{exercise?.code} · {period?.name} · {version?.code}</p></div></div><strong>{formatReportValue(totalBudget, "money", "PEN")}</strong></section>
    <section className="phase11-summary-grid">{sections.map((section) => <article className="phase11-summary-card" key={section.key}><span>{section.title}</span><strong>{formatReportValue(section.total, "money", "PEN")}</strong><small>{section.rows.length} partidas</small></article>)}</section>
    {sections.map((section) => <section className="panel" key={section.key}><div className="panel__heading"><div><span className="eyebrow">{section.rows.length} partidas · {formatReportValue(section.total, "money", "PEN")}</span><h2>{section.title}</h2><p>{section.description}</p></div></div><DataTable headers={["Centro", "Elemento", "Cuenta", "Partida", "Sección", "Clasificación", "Importe"]} rows={section.rows.slice(0, 80).map((row) => [`${row.center_code ?? "—"} ${row.center_name ?? ""}`, `${row.element_code ?? "—"} ${row.element_name ?? ""}`, `${row.account_code ?? "—"} ${row.account_name ?? ""}`, row.line_name, row.statement_section?.replaceAll("_", " ") ?? "PRESUPUESTO", `${row.account_nature ?? "—"} · ${row.cost_behavior ?? "—"} · ${row.cost_traceability ?? "—"}`, formatReportValue(row.amount, "money", "PEN")])} empty="No se identificaron partidas para esta sección." /></section>)}
    {unclassified.length > 0 && <section className="panel"><div className="panel__heading"><div><span className="eyebrow">Revisión</span><h2>Partidas presupuestadas sin clasificar</h2><p>Puede mejorar la clasificación editando la partida en Tablas maestras.</p></div></div><DataTable headers={["Cuenta", "Partida", "Importe", "Observación"]} rows={unclassified.map((row) => [row.account_name ?? row.account_code ?? "—", row.line_name, formatReportValue(row.amount, "money", "PEN"), "No coincide con los criterios del presupuesto maestro"])} /></section>}
  </div>;
}
