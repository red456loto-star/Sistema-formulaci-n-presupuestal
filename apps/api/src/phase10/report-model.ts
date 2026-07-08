import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { getBalanceSheet, getIncomeStatement, getMasterSummary } from "../phase6/calculations";
import { buildCorrectedFinancialSnapshot } from "../phase8/corrections";
import type { AnalysisDescriptor } from "../phase8/calculations";
import { buildPhase9Analysis, type Phase9Input } from "../phase9/calculations";

export type ReportType = "ORIGINAL" | "FORECAST" | "MASTER" | "FINANCIAL" | "VARIANCES" | "CENTERS" | "EXECUTIVE" | "DASHBOARD" | "PROPOSALS";
export type ReportValueType = "text" | "money" | "percent" | "number" | "date" | "status";

export interface ReportInput {
  company_id: number;
  exercise_id: number;
  version_id: number;
  report_type: ReportType;
  period_number?: number | null;
  center_id?: number | null;
  responsible_id?: number | null;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportValueType;
}

export interface ReportDocument {
  report_type: ReportType;
  title: string;
  subtitle: string;
  file_slug: string;
  context: {
    company_id: number;
    company_name: string;
    exercise_id: number;
    exercise_code: string;
    budget_year: number;
    version_id: number;
    version_code: string;
    version_name: string;
    version_type: string;
    version_status: string;
    currency_code: string;
    currency_symbol: string;
    period_number: number | null;
    period_label: string;
    center_id: number | null;
    center_label: string;
    responsible_id: number | null;
    responsible_label: string;
  };
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  summary: Array<{ label: string; value: unknown; type: ReportValueType }>;
  notes: string[];
  generated_at: string;
}

interface ReportContext {
  company: Record<string, unknown>;
  exercise: Record<string, unknown>;
  version: Record<string, unknown>;
  center: Record<string, unknown> | null;
  responsible: Record<string, unknown> | null;
  period: Record<string, unknown> | null;
  currency: Record<string, unknown>;
}

function ensureContext(database: DatabaseManager, input: ReportInput): ReportContext {
  const company = database.connection.prepare("SELECT * FROM companies WHERE id=? AND active=1").get(input.company_id) as Record<string, unknown> | undefined;
  if (!company) httpError("La empresa seleccionada no existe o está inactiva.", 400);
  const exercise = database.connection.prepare("SELECT * FROM budget_exercises WHERE id=? AND company_id=?").get(input.exercise_id, input.company_id) as Record<string, unknown> | undefined;
  if (!exercise) httpError("El ejercicio no pertenece a la empresa seleccionada.", 400);
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?")
    .get(input.version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece a la empresa y ejercicio seleccionados.", 400);
  const currency = database.connection.prepare("SELECT * FROM currencies WHERE id=?").get(exercise.currency_id) as Record<string, unknown> | undefined;
  if (!currency) httpError("La moneda del ejercicio no está disponible.", 409);

  let period: Record<string, unknown> | null = null;
  if (input.period_number) {
    period = database.connection.prepare("SELECT * FROM budget_periods WHERE company_id=? AND exercise_id=? AND period_number=?")
      .get(input.company_id, input.exercise_id, input.period_number) as Record<string, unknown> | undefined ?? null;
    if (!period) httpError("El periodo no pertenece al ejercicio seleccionado.", 400);
  }

  let center: Record<string, unknown> | null = null;
  if (input.center_id) {
    center = database.connection.prepare(`SELECT c.*,s.name site_name,r.full_name responsible_name,r.position responsible_position,r.email responsible_email
      FROM activity_centers c JOIN sites s ON s.id=c.site_id JOIN responsibles r ON r.id=c.responsible_id
      WHERE c.id=? AND c.company_id=? AND c.active=1`).get(input.center_id, input.company_id) as Record<string, unknown> | undefined ?? null;
    if (!center) httpError("El centro no pertenece a la empresa seleccionada.", 400);
  }

  let responsible: Record<string, unknown> | null = null;
  if (input.responsible_id) {
    responsible = database.connection.prepare("SELECT * FROM responsibles WHERE id=? AND company_id=? AND active=1")
      .get(input.responsible_id, input.company_id) as Record<string, unknown> | undefined ?? null;
    if (!responsible) httpError("El responsable no pertenece a la empresa seleccionada.", 400);
    if (center && Number(center.responsible_id) !== input.responsible_id) {
      httpError("El responsable seleccionado no corresponde al centro indicado.", 400);
    }
  }

  return { company, exercise, version, center, responsible, period, currency };
}

function reportContext(input: ReportInput, context: ReportContext): ReportDocument["context"] {
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
    currency_code: String(context.currency.code),
    currency_symbol: String(context.currency.symbol),
    period_number: input.period_number ?? null,
    period_label: context.period ? `${context.period.period_number} · ${context.period.name}` : "Total anual",
    center_id: input.center_id ?? null,
    center_label: context.center ? `${context.center.code} · ${context.center.name}` : "Todos los centros",
    responsible_id: input.responsible_id ?? null,
    responsible_label: context.responsible ? `${context.responsible.full_name} · ${context.responsible.position}` : context.center ? `${context.center.responsible_name} · ${context.center.responsible_position}` : "Todos los responsables",
  };
}

function createDocument(input: ReportInput, context: ReportContext, data: Omit<ReportDocument, "report_type" | "context" | "generated_at">): ReportDocument {
  return {
    report_type: input.report_type,
    context: reportContext(input, context),
    generated_at: new Date().toISOString(),
    ...data,
  };
}

function whereFilters(input: ReportInput, aliases: { period?: string; center?: string } = {}) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (input.period_number && aliases.period) {
    clauses.push(`${aliases.period}.period_number=?`);
    params.push(input.period_number);
  }
  if (input.center_id && aliases.center) {
    clauses.push(`${aliases.center}.id=?`);
    params.push(input.center_id);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

function sumRows(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((sum, row) => sum + (Number.isFinite(Number(row[key])) ? Number(row[key]) : 0), 0);
}

function originalReport(database: DatabaseManager, input: ReportInput, context: ReportContext) {
  if (String(context.version.version_type) !== "ORIGINAL") httpError("El reporte de presupuesto original requiere una versión ORIGINAL.", 400);
  const filter = whereFilters(input, { period: "p", center: "c" });
  const rows = database.connection.prepare(`SELECT p.period_number,p.name period_name,c.code center_code,c.name center_name,
      r.full_name responsible_name,g.code group_code,g.name group_name,e.code element_code,e.name element_name,
      a.code account_code,a.name account_name,a.nature account_nature,m.budgeted_value,m.real_value,l.source_text
    FROM budget_original_lines l
    JOIN budget_original_monthly_values m ON m.line_id=l.id
    JOIN budget_periods p ON p.id=m.period_id
    JOIN activity_centers c ON c.id=l.center_id
    LEFT JOIN responsibles r ON r.id=l.responsible_id
    JOIN budget_groups g ON g.id=l.group_id
    JOIN budget_elements e ON e.id=l.element_id
    JOIN budget_accounts a ON a.id=l.account_id
    WHERE l.company_id=? AND l.exercise_id=? AND l.version_id=?${filter.sql}
    ORDER BY p.period_number,c.code,g.code,e.code,a.code`)
    .all(input.company_id, input.exercise_id, input.version_id, ...filter.params) as Array<Record<string, unknown>>;
  const total = sumRows(rows, "budgeted_value");
  return createDocument(input, context, {
    title: "Presupuesto original mensualizado",
    subtitle: "Detalle por periodo, centro y cuenta presupuestal",
    file_slug: `presupuesto-original-${context.version.code}`,
    columns: [
      { key: "period_number", label: "Mes", type: "number" }, { key: "period_name", label: "Periodo", type: "text" },
      { key: "center_code", label: "Centro", type: "text" }, { key: "center_name", label: "Nombre del centro", type: "text" },
      { key: "responsible_name", label: "Responsable", type: "text" }, { key: "group_name", label: "Grupo", type: "text" },
      { key: "element_name", label: "Elemento", type: "text" }, { key: "account_code", label: "Cuenta", type: "text" },
      { key: "account_name", label: "Nombre de cuenta", type: "text" }, { key: "budgeted_value", label: "Presupuestado", type: "money" },
      { key: "real_value", label: "Real referencial", type: "money" }, { key: "source_text", label: "Fuente", type: "text" },
    ],
    rows,
    summary: [{ label: "Total presupuestado", value: total, type: "money" }, { label: "Registros", value: rows.length, type: "number" }],
    notes: rows.length ? [] : ["No existen líneas del presupuesto original para los filtros seleccionados."],
  });
}

function forecastReport(database: DatabaseManager, input: ReportInput, context: ReportContext) {
  if (String(context.version.version_type) !== "FORECAST") httpError("El reporte forecast requiere una versión FORECAST.", 400);
  const filter = whereFilters(input, { period: "p", center: "c" });
  const rows = database.connection.prepare(`SELECT p.period_number,p.name period_name,c.code center_code,c.name center_name,
      r.full_name responsible_name,g.code group_code,g.name group_name,e.code element_code,e.name element_name,
      a.code account_code,a.name account_name,f.original_budget,f.actual_value,f.projected_value,f.forecast_value,
      (f.forecast_value-f.original_budget) variation,f.value_origin,f.source_reference
    FROM forecast_values f
    JOIN budget_periods p ON p.id=f.period_id
    JOIN activity_centers c ON c.id=f.center_id
    JOIN responsibles r ON r.id=f.responsible_id
    JOIN budget_groups g ON g.id=f.group_id
    JOIN budget_elements e ON e.id=f.element_id
    JOIN budget_accounts a ON a.id=f.account_id
    WHERE f.company_id=? AND f.exercise_id=? AND f.forecast_version_id=?${filter.sql}
    ORDER BY p.period_number,c.code,g.code,e.code,a.code`)
    .all(input.company_id, input.exercise_id, input.version_id, ...filter.params) as Array<Record<string, unknown>>;
  return createDocument(input, context, {
    title: "Presupuesto revisado forecast",
    subtitle: "Valores reales al corte y proyecciones posteriores",
    file_slug: `forecast-${context.version.code}`,
    columns: [
      { key: "period_number", label: "Mes", type: "number" }, { key: "period_name", label: "Periodo", type: "text" },
      { key: "center_code", label: "Centro", type: "text" }, { key: "center_name", label: "Nombre del centro", type: "text" },
      { key: "responsible_name", label: "Responsable", type: "text" }, { key: "account_code", label: "Cuenta", type: "text" },
      { key: "account_name", label: "Nombre de cuenta", type: "text" }, { key: "original_budget", label: "Original", type: "money" },
      { key: "actual_value", label: "Real", type: "money" }, { key: "projected_value", label: "Proyectado", type: "money" },
      { key: "forecast_value", label: "Forecast", type: "money" }, { key: "variation", label: "Variación", type: "money" },
      { key: "value_origin", label: "Origen", type: "status" }, { key: "source_reference", label: "Fuente", type: "text" },
    ],
    rows,
    summary: [
      { label: "Presupuesto original", value: sumRows(rows, "original_budget"), type: "money" },
      { label: "Forecast", value: sumRows(rows, "forecast_value"), type: "money" },
      { label: "Variación", value: sumRows(rows, "variation"), type: "money" },
    ],
    notes: rows.length ? [] : ["No existen valores forecast para los filtros seleccionados."],
  });
}

function masterReport(database: DatabaseManager, input: ReportInput, context: ReportContext) {
  if (String(context.version.version_type) !== "ORIGINAL") httpError("El presupuesto maestro está vinculado a una versión ORIGINAL.", 400);
  const masterContext = { companyId: input.company_id, exerciseId: input.exercise_id, versionId: input.version_id };
  const income = getIncomeStatement(database, masterContext);
  const balance = getBalanceSheet(database, masterContext);
  const rows = income.monthly.filter((row) => !input.period_number || Number(row.period_number) === input.period_number).map((row) => {
    const financial = balance.monthly.find((item) => Number(item.period_number) === Number(row.period_number));
    return {
      ...row,
      total_assets: financial?.total_assets ?? null,
      total_liabilities: financial?.total_liabilities ?? null,
      equity: financial?.equity ?? null,
      balanced: financial?.balanced ? "Sí" : "No",
    };
  });
  const summary = getMasterSummary(database, masterContext);
  return createDocument(input, context, {
    title: "Presupuesto maestro",
    subtitle: "Integración mensual de ventas, costos, gastos, inversiones y estados financieros",
    file_slug: `presupuesto-maestro-${context.version.code}`,
    columns: [
      { key: "period_number", label: "Mes", type: "number" }, { key: "period_name", label: "Periodo", type: "text" },
      { key: "sales", label: "Ventas", type: "money" }, { key: "production_cost", label: "Costo de producción", type: "money" },
      { key: "operating_expenses", label: "Gastos", type: "money" }, { key: "operating_income", label: "Resultado operativo", type: "money" },
      { key: "net_income", label: "Resultado neto", type: "money" }, { key: "total_assets", label: "Activos", type: "money" },
      { key: "total_liabilities", label: "Pasivos", type: "money" }, { key: "equity", label: "Patrimonio", type: "money" },
      { key: "balanced", label: "Balanceado", type: "status" },
    ],
    rows,
    summary: [
      { label: "Ventas anuales", value: summary.sales_total, type: "money" },
      { label: "Costo de producción", value: summary.production_cost, type: "money" },
      { label: "Gastos", value: summary.expenses_total, type: "money" },
      { label: "Inversiones", value: summary.investments_total, type: "money" },
      { label: "Resultado neto", value: summary.net_income, type: "money" },
    ],
    notes: summary.balance_ok ? [] : ["El estado de situación financiera requiere revisión porque no está balanceado."],
  });
}

function financialReport(database: DatabaseManager, input: ReportInput, context: ReportContext) {
  const sourceType = String(context.version.version_type) === "FORECAST" ? "FORECAST" : "ORIGINAL";
  const descriptor: AnalysisDescriptor = { company_id: input.company_id, exercise_id: input.exercise_id, version_id: input.version_id, source_type: sourceType, period_number: input.period_number ?? null };
  const snapshot = buildCorrectedFinancialSnapshot(database, descriptor);
  const incomeLabels: Array<[string, string]> = [
    ["sales", "Ventas"], ["cost_of_sales", "Costo de ventas"], ["gross_profit", "Utilidad bruta"],
    ["operating_expenses", "Gastos operativos"], ["operating_income", "Utilidad operativa"], ["pre_tax_income", "Resultado antes de impuestos"],
    ["income_tax", "Impuesto a la renta"], ["net_income", "Resultado neto"],
  ];
  const balanceLabels: Array<[string, string]> = [
    ["cash", "Efectivo"], ["receivables", "Cuentas por cobrar"], ["inventory", "Inventarios"],
    ["current_assets", "Activos corrientes"], ["noncurrent_assets", "Activos no corrientes"], ["total_assets", "Total activos"],
    ["current_liabilities", "Pasivos corrientes"], ["noncurrent_liabilities", "Pasivos no corrientes"], ["total_liabilities", "Total pasivos"],
    ["equity", "Patrimonio"], ["total_liabilities_and_equity", "Pasivo y patrimonio"],
  ];
  const rows: Array<Record<string, unknown>> = [
    ...incomeLabels.map(([key, label]) => ({ statement: "Estado de resultados", item: label, value: (snapshot.income_statement as unknown as Record<string, unknown>)[key] })),
    ...balanceLabels.map(([key, label]) => ({ statement: "Situación financiera", item: label, value: (snapshot.balance_sheet as unknown as Record<string, unknown>)[key] })),
    ...snapshot.ratios.map((ratio) => ({ statement: `Ratio · ${ratio.category}`, item: ratio.name, value: ratio.result, formula: ratio.formula, interpretation: ratio.interpretation })),
    { statement: "Dupont", item: "ROE", value: snapshot.dupont.roe, formula: snapshot.dupont.formula, interpretation: snapshot.dupont.interpretation },
    { statement: "EVA", item: "Valor económico agregado", value: snapshot.eva.eva, formula: snapshot.eva.formula, interpretation: snapshot.eva.interpretation },
  ];
  return createDocument(input, context, {
    title: "Estados y análisis financiero",
    subtitle: `${sourceType === "FORECAST" ? "Forecast" : "Presupuesto original"} · ${snapshot.context.period_label}`,
    file_slug: `estados-financieros-${context.version.code}`,
    columns: [
      { key: "statement", label: "Sección", type: "text" }, { key: "item", label: "Partida o indicador", type: "text" },
      { key: "value", label: "Resultado", type: "money" }, { key: "formula", label: "Fórmula", type: "text" },
      { key: "interpretation", label: "Interpretación", type: "text" },
    ],
    rows,
    summary: [
      { label: "Ventas", value: snapshot.income_statement.sales, type: "money" },
      { label: "Resultado neto", value: snapshot.income_statement.net_income, type: "money" },
      { label: "Total activos", value: snapshot.balance_sheet.total_assets, type: "money" },
      { label: "EVA", value: snapshot.eva.eva, type: "money" },
    ],
    notes: snapshot.warnings,
  });
}

function phase9Input(database: DatabaseManager, input: ReportInput, context: ReportContext): Phase9Input {
  if (String(context.version.version_type) === "FORECAST") {
    const profile = database.connection.prepare("SELECT original_version_id FROM forecast_profiles WHERE forecast_version_id=?").get(input.version_id) as { original_version_id: number } | undefined;
    if (!profile) httpError("La versión forecast no tiene perfil asociado.", 409);
    return {
      company_id: input.company_id, exercise_id: input.exercise_id, original_version_id: Number(profile.original_version_id),
      forecast_version_id: input.version_id, period_number: input.period_number ?? null, center_id: input.center_id ?? null,
      comparison: "ORIGINAL_FORECAST", materiality_threshold: 10,
    };
  }
  return {
    company_id: input.company_id, exercise_id: input.exercise_id, original_version_id: input.version_id,
    forecast_version_id: null, period_number: input.period_number ?? null, center_id: input.center_id ?? null,
    comparison: "ORIGINAL_REAL", materiality_threshold: 10,
  };
}

function variationsReport(database: DatabaseManager, input: ReportInput, context: ReportContext) {
  const analysis = buildPhase9Analysis(database, phase9Input(database, input, context));
  const rows = analysis.variations.rows.map((row) => ({
    period: `${row.period_number} · ${row.period_name}`, center: `${row.center_code} · ${row.center_name}`,
    group: `${row.group_code} · ${row.group_name}`, element: `${row.element_code} · ${row.element_name}`,
    account: `${row.account_code} · ${row.account_name}`, base_value: row.base_value, comparison_value: row.comparison_value,
    monetary_variation: row.monetary_variation, percentage_variation: row.percentage_variation,
    execution_percentage: row.execution_percentage, participation_percentage: row.participation_percentage,
    status: row.status, material: row.material ? "Sí" : "No", source_reference: row.source_reference,
  }));
  return createDocument(input, context, {
    title: "Análisis de variaciones",
    subtitle: `${analysis.context.base_label} versus ${analysis.context.comparison_label}`,
    file_slug: `variaciones-${context.version.code}`,
    columns: [
      { key: "period", label: "Periodo", type: "text" }, { key: "center", label: "Centro", type: "text" },
      { key: "group", label: "Grupo", type: "text" }, { key: "element", label: "Elemento", type: "text" },
      { key: "account", label: "Cuenta", type: "text" }, { key: "base_value", label: analysis.context.base_label, type: "money" },
      { key: "comparison_value", label: analysis.context.comparison_label, type: "money" }, { key: "monetary_variation", label: "Variación", type: "money" },
      { key: "percentage_variation", label: "Variación %", type: "percent" }, { key: "execution_percentage", label: "Ejecución %", type: "percent" },
      { key: "participation_percentage", label: "Participación %", type: "percent" }, { key: "status", label: "Estado", type: "status" },
      { key: "material", label: "Material", type: "status" }, { key: "source_reference", label: "Fuente", type: "text" },
    ],
    rows,
    summary: [
      { label: "Valor base", value: analysis.variations.summary.base_value, type: "money" },
      { label: "Valor comparado", value: analysis.variations.summary.comparison_value, type: "money" },
      { label: "Variación", value: analysis.variations.summary.monetary_variation, type: "money" },
      { label: "Ejecución", value: analysis.variations.summary.execution_percentage, type: "percent" },
      { label: "Cobertura", value: analysis.variations.summary.coverage_percentage, type: "percent" },
    ],
    notes: analysis.warnings,
  });
}

function centersReport(database: DatabaseManager, input: ReportInput, context: ReportContext) {
  const isForecast = String(context.version.version_type) === "FORECAST";
  const periodClause = input.period_number ? " AND p.period_number=?" : "";
  const centerClause = input.center_id ? " AND c.id=?" : "";
  const params = [input.company_id, input.exercise_id, input.version_id, ...(input.period_number ? [input.period_number] : []), ...(input.center_id ? [input.center_id] : [])];
  const sql = isForecast
    ? `SELECT c.id center_id,c.code center_code,c.name center_name,s.name site_name,r.full_name responsible_name,r.position responsible_position,r.email responsible_email,
        SUM(f.original_budget) original_value,SUM(f.forecast_value) current_value,SUM(f.forecast_value-f.original_budget) variation
      FROM forecast_values f JOIN budget_periods p ON p.id=f.period_id JOIN activity_centers c ON c.id=f.center_id
      JOIN sites s ON s.id=c.site_id JOIN responsibles r ON r.id=c.responsible_id
      WHERE f.company_id=? AND f.exercise_id=? AND f.forecast_version_id=?${periodClause}${centerClause}
      GROUP BY c.id,c.code,c.name,s.name,r.full_name,r.position,r.email ORDER BY ABS(SUM(f.forecast_value-f.original_budget)) DESC`
    : `SELECT c.id center_id,c.code center_code,c.name center_name,s.name site_name,r.full_name responsible_name,r.position responsible_position,r.email responsible_email,
        SUM(m.budgeted_value) original_value,SUM(COALESCE(m.real_value,m.budgeted_value)) current_value,SUM(COALESCE(m.real_value,m.budgeted_value)-m.budgeted_value) variation
      FROM budget_original_lines l JOIN budget_original_monthly_values m ON m.line_id=l.id JOIN budget_periods p ON p.id=m.period_id
      JOIN activity_centers c ON c.id=l.center_id JOIN sites s ON s.id=c.site_id JOIN responsibles r ON r.id=c.responsible_id
      WHERE l.company_id=? AND l.exercise_id=? AND l.version_id=?${periodClause}${centerClause}
      GROUP BY c.id,c.code,c.name,s.name,r.full_name,r.position,r.email ORDER BY ABS(SUM(COALESCE(m.real_value,m.budgeted_value)-m.budgeted_value)) DESC`;
  const rows = database.connection.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  const baseTotal = sumRows(rows, "original_value");
  const normalized = rows.map((row) => ({
    ...row,
    participation_percentage: baseTotal === 0 ? null : Math.abs(Number(row.original_value)) / Math.abs(baseTotal) * 100,
    execution_percentage: Number(row.original_value) === 0 ? null : Number(row.current_value) / Math.abs(Number(row.original_value)) * 100,
  }));
  return createDocument(input, context, {
    title: "Presupuesto por centros de actividad",
    subtitle: "Responsable, participación, ejecución y desviación por centro",
    file_slug: `centros-${context.version.code}`,
    columns: [
      { key: "center_code", label: "Centro", type: "text" }, { key: "center_name", label: "Nombre", type: "text" },
      { key: "site_name", label: "Sede", type: "text" }, { key: "responsible_name", label: "Responsable", type: "text" },
      { key: "responsible_position", label: "Cargo", type: "text" }, { key: "responsible_email", label: "Correo", type: "text" },
      { key: "original_value", label: "Base", type: "money" }, { key: "current_value", label: isForecast ? "Forecast" : "Real / presupuesto", type: "money" },
      { key: "variation", label: "Variación", type: "money" }, { key: "execution_percentage", label: "Ejecución %", type: "percent" },
      { key: "participation_percentage", label: "Participación %", type: "percent" },
    ],
    rows: normalized,
    summary: [
      { label: "Total base", value: baseTotal, type: "money" },
      { label: "Total comparado", value: sumRows(rows, "current_value"), type: "money" },
      { label: "Centros", value: rows.length, type: "number" },
    ],
    notes: rows.length ? [] : ["No existen valores por centro para los filtros seleccionados."],
  });
}

function executiveReport(database: DatabaseManager, input: ReportInput, context: ReportContext, dashboard: boolean) {
  const analysis = buildPhase9Analysis(database, phase9Input(database, input, context));
  const scenario = String(context.version.version_type) === "FORECAST" ? analysis.dashboard.scenarios.forecast : analysis.dashboard.scenarios.original;
  const indicators = [
    { category: "Escenario", indicator: "Ventas", value: scenario.sales, unit: context.currency.code },
    { category: "Escenario", indicator: "Costos", value: scenario.costs, unit: context.currency.code },
    { category: "Escenario", indicator: "Gastos", value: scenario.expenses, unit: context.currency.code },
    { category: "Escenario", indicator: "Resultado", value: scenario.result, unit: context.currency.code },
    { category: "Escenario", indicator: "Rentabilidad", value: scenario.profitability, unit: "%" },
    { category: "Control", indicator: "Variación", value: analysis.variations.summary.monetary_variation, unit: context.currency.code },
    { category: "Control", indicator: "Ejecución", value: analysis.variations.summary.execution_percentage, unit: "%" },
    { category: "Control", indicator: "Cobertura", value: analysis.variations.summary.coverage_percentage, unit: "%" },
    { category: "Control", indicator: "Centros críticos", value: analysis.dashboard.critical_centers.filter((row) => row.unfavorable_impact > 0).length, unit: "centros" },
    { category: "Costos", indicator: "Impacto en resultado", value: analysis.relevance.summary.result_impact, unit: context.currency.code },
    { category: "Costos", indicator: "Impacto en rentabilidad", value: analysis.relevance.summary.profitability_impact, unit: "%" },
  ];
  const trendRows = dashboard ? analysis.dashboard.trend.filter((row) => row.has_data).map((row) => ({
    category: "Tendencia", indicator: `${row.period_number} · ${row.period_name}`, value: row.comparison_value, unit: context.currency.code,
    base_value: row.base_value, variation: row.monetary_variation, execution: row.execution_percentage,
  })) : [];
  const criticalRows = dashboard ? analysis.dashboard.critical_centers.slice(0, 10).map((row) => ({
    category: "Centro crítico", indicator: `${row.code} · ${row.name}`, value: row.monetary_variation, unit: context.currency.code,
    base_value: row.base_value, variation: row.unfavorable_impact, execution: row.variance_impact_percentage,
  })) : [];
  return createDocument(input, context, {
    title: dashboard ? "Reporte del dashboard presupuestal" : "Resumen ejecutivo presupuestal",
    subtitle: `${analysis.context.base_label} versus ${analysis.context.comparison_label}`,
    file_slug: `${dashboard ? "dashboard" : "resumen-ejecutivo"}-${context.version.code}`,
    columns: [
      { key: "category", label: "Categoría", type: "text" }, { key: "indicator", label: "Indicador", type: "text" },
      { key: "value", label: "Valor", type: "number" }, { key: "unit", label: "Unidad", type: "text" },
      { key: "base_value", label: "Base", type: "money" }, { key: "variation", label: "Variación / impacto", type: "money" },
      { key: "execution", label: "Ejecución / participación %", type: "percent" },
    ],
    rows: [...indicators, ...trendRows, ...criticalRows],
    summary: [
      { label: "Resultado", value: scenario.result, type: "money" },
      { label: "Rentabilidad", value: scenario.profitability, type: "percent" },
      { label: "Variación", value: analysis.variations.summary.monetary_variation, type: "money" },
      { label: "Ejecución", value: analysis.variations.summary.execution_percentage, type: "percent" },
    ],
    notes: analysis.warnings,
  });
}

function proposalsReport(database: DatabaseManager, input: ReportInput, context: ReportContext) {
  const filters = whereFilters(input, { period: "p", center: "c" });
  const rows = database.connection.prepare(`SELECT ip.id,ip.source_type,ip.problem,ip.evidence_value,ip.evidence_unit,ip.evidence_text,
      ip.probable_cause,ip.proposed_action,ip.expected_impact,ip.profitability_impact,ip.priority,ip.due_date,ip.status,
      c.code center_code,c.name center_name,e.code element_code,e.name element_name,a.code account_code,a.name account_name,
      r.full_name responsible_name,r.position responsible_position
    FROM improvement_proposals ip
    LEFT JOIN budget_periods p ON p.id=ip.period_id
    LEFT JOIN activity_centers c ON c.id=ip.center_id
    LEFT JOIN budget_elements e ON e.id=ip.element_id
    LEFT JOIN budget_accounts a ON a.id=ip.account_id
    JOIN responsibles r ON r.id=ip.responsible_id
    WHERE ip.company_id=? AND ip.exercise_id=? AND ip.version_id=?${filters.sql}
    ORDER BY CASE ip.priority WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,ip.due_date,ip.id DESC`)
    .all(input.company_id, input.exercise_id, input.version_id, ...filters.params) as Array<Record<string, unknown>>;
  return createDocument(input, context, {
    title: "Propuestas de mejora",
    subtitle: "Acciones sustentadas en evidencia cuantitativa y efecto esperado",
    file_slug: `propuestas-mejora-${context.version.code}`,
    columns: [
      { key: "priority", label: "Prioridad", type: "status" }, { key: "status", label: "Estado", type: "status" },
      { key: "problem", label: "Problema", type: "text" }, { key: "evidence_value", label: "Evidencia", type: "number" },
      { key: "evidence_unit", label: "Unidad", type: "text" }, { key: "evidence_text", label: "Sustento", type: "text" },
      { key: "center_name", label: "Centro", type: "text" }, { key: "element_name", label: "Elemento", type: "text" },
      { key: "account_name", label: "Cuenta", type: "text" }, { key: "probable_cause", label: "Causa probable", type: "text" },
      { key: "proposed_action", label: "Acción", type: "text" }, { key: "expected_impact", label: "Impacto esperado", type: "money" },
      { key: "profitability_impact", label: "Impacto rentabilidad", type: "percent" }, { key: "responsible_name", label: "Responsable", type: "text" },
      { key: "due_date", label: "Plazo", type: "date" },
    ],
    rows,
    summary: [
      { label: "Propuestas", value: rows.length, type: "number" },
      { label: "Prioridad alta", value: rows.filter((row) => row.priority === "ALTA").length, type: "number" },
      { label: "Impacto esperado", value: sumRows(rows, "expected_impact"), type: "money" },
    ],
    notes: rows.length ? [] : ["No existen propuestas registradas para la versión y filtros seleccionados."],
  });
}

export function buildReport(database: DatabaseManager, input: ReportInput): ReportDocument {
  const context = ensureContext(database, input);
  switch (input.report_type) {
    case "ORIGINAL": return originalReport(database, input, context);
    case "FORECAST": return forecastReport(database, input, context);
    case "MASTER": return masterReport(database, input, context);
    case "FINANCIAL": return financialReport(database, input, context);
    case "VARIANCES": return variationsReport(database, input, context);
    case "CENTERS": return centersReport(database, input, context);
    case "EXECUTIVE": return executiveReport(database, input, context, false);
    case "DASHBOARD": return executiveReport(database, input, context, true);
    case "PROPOSALS": return proposalsReport(database, input, context);
    default: httpError("El tipo de reporte no está disponible.", 400);
  }
}

export function getReportOptions(database: DatabaseManager, companyId: number, exerciseId: number) {
  const exercise = database.connection.prepare("SELECT id FROM budget_exercises WHERE id=? AND company_id=?").get(exerciseId, companyId);
  if (!exercise) httpError("El ejercicio no pertenece a la empresa seleccionada.", 400);
  return {
    versions: database.connection.prepare(`SELECT id,code,name,version_type,status,source_version_id,approved_at,closed_at
      FROM budget_versions WHERE company_id=? AND exercise_id=? ORDER BY version_type,version_number DESC`).all(companyId, exerciseId),
    approved_versions: database.connection.prepare(`SELECT id,code,name,version_type,status,source_version_id,approved_at,closed_at
      FROM budget_versions WHERE company_id=? AND exercise_id=? AND status IN ('APROBADO','CERRADO') ORDER BY version_type,version_number DESC`).all(companyId, exerciseId),
    centers: database.connection.prepare(`SELECT c.id,c.code,c.name,c.center_type,c.responsible_id,r.full_name responsible_name,r.position responsible_position,r.email responsible_email
      FROM activity_centers c JOIN responsibles r ON r.id=c.responsible_id WHERE c.company_id=? AND c.active=1 ORDER BY c.code`).all(companyId),
    responsibles: database.connection.prepare("SELECT id,code,full_name,position,email FROM responsibles WHERE company_id=? AND active=1 ORDER BY full_name").all(companyId),
  };
}
