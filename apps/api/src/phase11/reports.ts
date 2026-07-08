import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import type { ReportDocument, ReportType, ReportValueType } from "../phase10/report-model";
import { buildPhase11Analysis } from "./analysis";
import { ensurePhase11Context, type Phase11ContextInput } from "./context";

export type Phase11ReportKind = "FINANCIAL" | "COSTS" | "VARIATIONS" | "DASHBOARD" | "PROPOSALS";

function contextForReport(database: DatabaseManager, input: Phase11ContextInput): ReportDocument["context"] {
  const context = ensurePhase11Context(database, input);
  const currency = database.connection.prepare("SELECT code,symbol FROM currencies WHERE id=?").get(context.exercise.currency_id) as { code: string; symbol: string } | undefined;
  return {
    company_id: input.company_id,
    company_name: String(context.company.commercial_name ?? context.company.legal_name),
    exercise_id: input.exercise_id,
    exercise_code: String(context.exercise.code),
    budget_year: Number(context.exercise.budget_year),
    version_id: input.version_id,
    version_code: String(context.version.code),
    version_name: String(context.version.name),
    version_type: String(context.version.version_type),
    version_status: String(context.version.status),
    currency_code: currency?.code ?? "PEN",
    currency_symbol: currency?.symbol ?? "S/",
    period_number: Number(context.period.period_number),
    period_label: `${context.period.period_number} · ${context.period.name}`,
    center_id: null,
    center_label: "Todos los centros",
    responsible_id: null,
    responsible_label: "Responsables según centro",
  };
}

function documentBase(database: DatabaseManager, input: Phase11ContextInput, data: Omit<ReportDocument, "context" | "generated_at">): ReportDocument {
  return { ...data, context: contextForReport(database, input), generated_at: new Date().toISOString() };
}

function moneySummary(label: string, value: unknown) { return { label, value, type: "money" as ReportValueType }; }
function numberSummary(label: string, value: unknown) { return { label, value, type: "number" as ReportValueType }; }
function percentSummary(label: string, value: unknown) { return { label, value, type: "percent" as ReportValueType }; }

export function buildPhase11Report(database: DatabaseManager, input: Phase11ContextInput, kind: Phase11ReportKind): ReportDocument {
  const analysis = buildPhase11Analysis(database, input);
  const suffix = `${analysis.context.version_code}-${analysis.context.period_number}-${analysis.context.budget_type_code}`;
  if (kind === "FINANCIAL") {
    const rows = [
      ...analysis.financial.horizontal.map((row) => ({ section: "Análisis horizontal", item: row.label, budgeted: row.budgeted, real: row.real, result: row.variation, percentage: row.variation_percentage, formula: "REAL - PRESUPUESTADO" })),
      ...analysis.financial.vertical.map((row) => ({ section: `Análisis vertical · ${row.data_kind}`, item: row.label, budgeted: row.data_kind === "PRESUPUESTADO" ? row.amount : null, real: row.data_kind === "REAL" ? row.amount : null, result: row.amount, percentage: row.vertical_percentage, formula: row.statement === "ESTADO_SITUACION" ? "PARTIDA / ACTIVO TOTAL" : "PARTIDA / VENTAS" })),
      ...analysis.financial.ratios.map((row) => ({ section: "Ratios", item: row.name, budgeted: null, real: null, result: row.result, percentage: null, formula: row.formula })),
      { section: "Dupont", item: "ROE Dupont", budgeted: null, real: null, result: analysis.financial.dupont.roe, percentage: analysis.financial.dupont.roe, formula: analysis.financial.dupont.formula },
      { section: "EVA", item: "Valor económico agregado", budgeted: null, real: null, result: analysis.financial.eva.eva, percentage: analysis.financial.eva.wacc_rate, formula: "NOPAT - CAPITAL INVERTIDO × WACC" },
    ];
    return documentBase(database, input, {
      report_type: "FINANCIAL",
      title: "Análisis integral de estados financieros",
      subtitle: "Análisis vertical, horizontal, ratios, Dupont y EVA calculados desde las tablas maestras",
      file_slug: `analisis-financiero-${suffix}`,
      columns: [
        { key: "section", label: "Análisis", type: "text" }, { key: "item", label: "Partida o indicador", type: "text" },
        { key: "budgeted", label: "Presupuestado", type: "money" }, { key: "real", label: "Real", type: "money" },
        { key: "result", label: "Resultado", type: "money" }, { key: "percentage", label: "Porcentaje", type: "percent" },
        { key: "formula", label: "Fórmula", type: "text" },
      ],
      rows,
      summary: [moneySummary("Ventas reales", analysis.financial.real.sales), moneySummary("Resultado real", analysis.financial.real.net_income), percentSummary("ROE Dupont", analysis.financial.dupont.roe), moneySummary("EVA", analysis.financial.eva.eva)],
      notes: analysis.warnings,
    });
  }
  if (kind === "COSTS") {
    const rows = [
      ...analysis.costs.by_center.map((row) => ({ dimension: "Centro", code: row.code, name: row.name, amount: row.amount, participation: row.participation })),
      ...analysis.costs.by_element.map((row) => ({ dimension: "Elemento", code: row.code, name: row.name, amount: row.amount, participation: row.participation })),
    ];
    return documentBase(database, input, {
      report_type: "CENTERS",
      title: "Relevancia de la estructura de costos",
      subtitle: "Costos fijos, variables, directos e indirectos por centro y elemento",
      file_slug: `relevancia-costos-${suffix}`,
      columns: [
        { key: "dimension", label: "Dimensión", type: "text" }, { key: "code", label: "Código", type: "text" },
        { key: "name", label: "Nombre", type: "text" }, { key: "amount", label: "Importe", type: "money" },
        { key: "participation", label: "Participación", type: "percent" },
      ],
      rows,
      summary: [moneySummary("Costo total", analysis.costs.summary.total), moneySummary("Costos fijos", analysis.costs.summary.fixed), moneySummary("Costos variables", analysis.costs.summary.variable), moneySummary("Punto de equilibrio", analysis.costs.summary.break_even_sales)],
      notes: analysis.warnings,
    });
  }
  if (kind === "VARIATIONS") {
    return documentBase(database, input, {
      report_type: "VARIANCES",
      title: "Análisis de variaciones presupuestales",
      subtitle: "Data presupuestada versus data real por periodo, tipo, elemento, cuenta y centro",
      file_slug: `variaciones-${suffix}`,
      columns: [
        { key: "center_code", label: "Centro", type: "text" }, { key: "center_name", label: "Nombre del centro", type: "text" },
        { key: "element_code", label: "Elemento", type: "text" }, { key: "element_name", label: "Nombre del elemento", type: "text" },
        { key: "account_code", label: "Cuenta", type: "text" }, { key: "account_name", label: "Nombre de cuenta", type: "text" },
        { key: "budgeted", label: "Presupuestado", type: "money" }, { key: "real", label: "Real", type: "money" },
        { key: "variation", label: "Variación", type: "money" }, { key: "variation_percentage", label: "Variación %", type: "percent" },
        { key: "execution_percentage", label: "Ejecución %", type: "percent" }, { key: "status", label: "Estado", type: "status" },
      ],
      rows: analysis.variations.rows,
      summary: [moneySummary("Presupuestado", analysis.variations.summary.budgeted), moneySummary("Real", analysis.variations.summary.real), moneySummary("Variación", analysis.variations.summary.variation), percentSummary("Ejecución", analysis.variations.summary.execution_percentage)],
      notes: analysis.warnings,
    });
  }
  if (kind === "DASHBOARD") {
    const rows = [
      ...analysis.dashboard.trend.map((row) => ({ category: "Tendencia", indicator: `${row.period_number} · ${row.period_name}`, budgeted: row.budgeted, real: row.real, variation: row.variation, percentage: row.execution_percentage })),
      ...analysis.dashboard.critical_items.map((row) => ({ category: "Partida crítica", indicator: `${row.center_code ?? "—"} · ${row.account_name}`, budgeted: row.budgeted, real: row.real, variation: row.variation, percentage: row.variation_percentage })),
    ];
    return documentBase(database, input, {
      report_type: "DASHBOARD",
      title: "Dashboard de presupuestos",
      subtitle: "Resumen ejecutivo, tendencia, ejecución y partidas críticas",
      file_slug: `dashboard-${suffix}`,
      columns: [
        { key: "category", label: "Categoría", type: "text" }, { key: "indicator", label: "Indicador", type: "text" },
        { key: "budgeted", label: "Presupuestado", type: "money" }, { key: "real", label: "Real", type: "money" },
        { key: "variation", label: "Variación", type: "money" }, { key: "percentage", label: "Porcentaje", type: "percent" },
      ],
      rows,
      summary: [moneySummary("Presupuestado", analysis.dashboard.summary.budgeted), moneySummary("Real", analysis.dashboard.summary.real), percentSummary("Ejecución", analysis.dashboard.summary.execution_percentage), numberSummary("Partidas desfavorables", analysis.dashboard.summary.unfavorable_items)],
      notes: analysis.warnings,
    });
  }
  const proposals = database.connection.prepare(`SELECT p.*,c.code center_code,c.name center_name,e.code element_code,e.name element_name,
      a.code account_code,a.name account_name,r.full_name responsible_name,r.position responsible_position
    FROM phase11_improvement_proposals p LEFT JOIN activity_centers c ON c.id=p.center_id
    LEFT JOIN budget_elements e ON e.id=p.element_id LEFT JOIN budget_accounts a ON a.id=p.account_id
    JOIN responsibles r ON r.id=p.responsible_id
    WHERE p.company_id=? AND p.exercise_id=? AND p.period_id=? AND p.version_id=? AND p.budget_type_id=?
    ORDER BY CASE p.priority WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,p.due_date,p.id DESC`)
    .all(input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id) as Array<Record<string, unknown>>;
  return documentBase(database, input, {
    report_type: "PROPOSALS",
    title: "Informe de propuestas de mejora",
    subtitle: "Acciones con evidencia e impacto positivo esperado en la rentabilidad",
    file_slug: `propuestas-${suffix}`,
    columns: [
      { key: "priority", label: "Prioridad", type: "status" }, { key: "status", label: "Estado", type: "status" },
      { key: "problem", label: "Problema", type: "text" }, { key: "evidence_text", label: "Evidencia", type: "text" },
      { key: "center_name", label: "Centro", type: "text" }, { key: "element_name", label: "Elemento", type: "text" },
      { key: "account_name", label: "Cuenta", type: "text" }, { key: "probable_cause", label: "Causa probable", type: "text" },
      { key: "proposed_action", label: "Acción propuesta", type: "text" }, { key: "expected_impact", label: "Impacto esperado", type: "money" },
      { key: "profitability_impact", label: "Impacto rentabilidad", type: "percent" }, { key: "responsible_name", label: "Responsable", type: "text" },
      { key: "due_date", label: "Plazo", type: "date" },
    ],
    rows: proposals,
    summary: [numberSummary("Propuestas", proposals.length), numberSummary("Prioridad alta", proposals.filter((row) => row.priority === "ALTA").length), moneySummary("Impacto esperado", proposals.reduce((sum, row) => sum + Number(row.expected_impact ?? 0), 0))],
    notes: proposals.length ? [] : ["No existen propuestas registradas para el contexto activo."],
  });
}

export function buildApprovedCenterMasterReport(database: DatabaseManager, input: { company_id: number; exercise_id: number; version_id: number; center_id: number; period_number?: number | null }): ReportDocument | null {
  const version = database.connection.prepare(`SELECT v.*,e.code exercise_code,e.budget_year,e.currency_id,c.commercial_name company_name
    FROM budget_versions v JOIN budget_exercises e ON e.id=v.exercise_id JOIN companies c ON c.id=v.company_id
    WHERE v.id=? AND v.company_id=? AND v.exercise_id=?`).get(input.version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!version || !["APROBADO","CERRADO"].includes(String(version.status))) return null;
  const periodClause = input.period_number ? " AND p.period_number=?" : "";
  const params = [input.company_id, input.exercise_id, input.version_id, input.center_id, ...(input.period_number ? [input.period_number] : [])];
  const rows = database.connection.prepare(`SELECT p.period_number,p.name period_name,bt.code budget_type_code,bt.name budget_type_name,
      r.element_code,r.element_name,r.account_code,r.account_name,r.line_code,r.line_name,r.amount,r.source_reference
    FROM master_data_rows r JOIN budget_periods p ON p.id=r.period_id JOIN budget_types bt ON bt.id=r.budget_type_id
    WHERE r.company_id=? AND r.exercise_id=? AND r.version_id=? AND r.center_id=? AND r.data_kind='PRESUPUESTADO'${periodClause}
    ORDER BY p.period_number,bt.sort_order,r.row_order,r.id`).all(...params) as Array<Record<string, unknown>>;
  if (!rows.length) return null;
  const center = database.connection.prepare(`SELECT c.code,c.name,r.id responsible_id,r.full_name responsible_name,r.position responsible_position
    FROM activity_centers c JOIN responsibles r ON r.id=c.responsible_id WHERE c.id=? AND c.company_id=?`).get(input.center_id, input.company_id) as Record<string, unknown>;
  const currency = database.connection.prepare("SELECT code,symbol FROM currencies WHERE id=?").get(version.currency_id) as { code: string; symbol: string } | undefined;
  const total = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return {
    report_type: "CENTERS" as ReportType,
    title: "Presupuesto aprobado por centro de actividad",
    subtitle: `${center.code} · ${center.name} · ${version.code}`,
    file_slug: `presupuesto-aprobado-${center.code}-${version.code}`,
    context: {
      company_id: input.company_id, company_name: String(version.company_name), exercise_id: input.exercise_id,
      exercise_code: String(version.exercise_code), budget_year: Number(version.budget_year), version_id: input.version_id,
      version_code: String(version.code), version_name: String(version.name), version_type: String(version.version_type), version_status: String(version.status),
      currency_code: currency?.code ?? "PEN", currency_symbol: currency?.symbol ?? "S/", period_number: input.period_number ?? null,
      period_label: input.period_number ? String(rows[0].period_name) : "Todos los periodos con data maestra", center_id: input.center_id,
      center_label: `${center.code} · ${center.name}`, responsible_id: Number(center.responsible_id), responsible_label: `${center.responsible_name} · ${center.responsible_position}`,
    },
    columns: [
      { key: "period_name", label: "Periodo", type: "text" }, { key: "budget_type_name", label: "Tipo de presupuesto", type: "text" },
      { key: "element_name", label: "Elemento", type: "text" }, { key: "account_name", label: "Cuenta", type: "text" },
      { key: "line_name", label: "Partida", type: "text" }, { key: "amount", label: "Importe aprobado", type: "money" },
      { key: "source_reference", label: "Fuente", type: "text" },
    ],
    rows,
    summary: [moneySummary("Total aprobado", total), numberSummary("Partidas", rows.length)],
    notes: [], generated_at: new Date().toISOString(),
  };
}
