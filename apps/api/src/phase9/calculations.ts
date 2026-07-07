import ExcelJS from "exceljs";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { roundAmount } from "../phase7/common";
import type { AnalysisDescriptor } from "../phase8/calculations";
import { buildCorrectedFinancialSnapshot } from "../phase8/corrections";

export type ComparisonType = "ORIGINAL_REAL" | "ORIGINAL_FORECAST" | "FORECAST_REAL";
export type VarianceStatus = "FAVORABLE" | "DESFAVORABLE" | "SIN_VARIACION" | "NEUTRAL" | "SIN_DATO";

export interface Phase9Input {
  company_id: number;
  exercise_id: number;
  original_version_id: number;
  forecast_version_id?: number | null;
  period_number?: number | null;
  center_id?: number | null;
  group_id?: number | null;
  element_id?: number | null;
  account_id?: number | null;
  budget_type?: string | null;
  comparison: ComparisonType;
  materiality_threshold?: number;
}

interface RawVarianceRow {
  period_id: number;
  period_number: number;
  period_name: string;
  center_id: number;
  center_code: string;
  center_name: string;
  group_id: number;
  group_code: string;
  group_name: string;
  element_id: number;
  element_code: string;
  element_name: string;
  account_id: number;
  account_code: string;
  account_name: string;
  account_nature: string;
  budget_type: string;
  base_value: number;
  comparison_value: number | null;
  source_reference: string | null;
}

export interface VariationRow extends RawVarianceRow {
  monetary_variation: number | null;
  percentage_variation: number | null;
  execution_percentage: number | null;
  participation_percentage: number;
  variance_impact_percentage: number;
  status: VarianceStatus;
  material: boolean;
}

export interface AggregatedRow {
  id: number | string;
  code: string;
  name: string;
  base_value: number;
  comparison_value: number;
  monetary_variation: number;
  participation_percentage: number;
  variance_impact_percentage: number;
  result_impact: number;
  profitability_impact: number | null;
  unfavorable_impact: number;
  material: boolean;
  status: VarianceStatus;
}

interface CostSourceRow {
  period_id: number;
  period_number: number;
  period_name: string;
  center_id: number;
  center_code: string;
  center_name: string;
  group_id: number;
  group_code: string;
  group_name: string;
  element_id: number;
  element_code: string;
  element_name: string;
  account_id: number;
  account_code: string;
  account_name: string;
  behavior: "FIJO" | "VARIABLE";
  traceability: "DIRECTO" | "INDIRECTO";
  category: string;
  base_value: number;
}

interface AllocatedCostRow extends CostSourceRow {
  comparison_value: number;
  monetary_variation: number;
  result_impact: number;
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nullable(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function divide(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function percentage(numerator: number, denominator: number) {
  const result = divide(numerator, Math.abs(denominator));
  return result === null ? null : roundAmount(result * 100, 2);
}

function rowKey(row: Pick<RawVarianceRow, "period_id" | "center_id" | "account_id">) {
  return `${row.period_id}:${row.center_id}:${row.account_id}`;
}

function statusFor(nature: string, difference: number | null): VarianceStatus {
  if (difference === null) return "SIN_DATO";
  if (Math.abs(difference) < 0.005) return "SIN_VARIACION";
  if (nature === "INGRESO") return difference > 0 ? "FAVORABLE" : "DESFAVORABLE";
  if (nature === "COSTO" || nature === "GASTO") return difference < 0 ? "FAVORABLE" : "DESFAVORABLE";
  return "NEUTRAL";
}

function ensureContext(database: DatabaseManager, input: Phase9Input) {
  const company = database.connection.prepare("SELECT * FROM companies WHERE id=? AND active=1").get(input.company_id) as Record<string, unknown> | undefined;
  if (!company) httpError("La empresa seleccionada no existe o está inactiva.", 400);
  const exercise = database.connection.prepare(`SELECT e.*,c.code currency_code,c.symbol currency_symbol
    FROM budget_exercises e JOIN currencies c ON c.id=e.currency_id
    WHERE e.id=? AND e.company_id=?`).get(input.exercise_id, input.company_id) as Record<string, unknown> | undefined;
  if (!exercise) httpError("El ejercicio no pertenece a la empresa activa.", 400);
  const original = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=? AND version_type='ORIGINAL'")
    .get(input.original_version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!original) httpError("Seleccione una versión original del ejercicio activo.", 400);

  let forecast: Record<string, unknown> | null = null;
  if (input.comparison !== "ORIGINAL_REAL") {
    if (!input.forecast_version_id) httpError("Seleccione una versión forecast para la comparación solicitada.", 400);
    forecast = database.connection.prepare(`SELECT v.*,fp.original_version_id,fp.cutoff_period_number,fp.revision_number
      FROM budget_versions v JOIN forecast_profiles fp ON fp.forecast_version_id=v.id
      WHERE v.id=? AND v.company_id=? AND v.exercise_id=? AND v.version_type='FORECAST'`)
      .get(input.forecast_version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined ?? null;
    if (!forecast) httpError("La versión forecast no pertenece a la empresa y ejercicio activos.", 400);
    if (Number(forecast.original_version_id) !== input.original_version_id) {
      httpError("El forecast seleccionado no deriva de la versión original indicada.", 400);
    }
  }

  if (input.period_number !== null && input.period_number !== undefined) {
    const period = database.connection.prepare("SELECT id FROM budget_periods WHERE company_id=? AND exercise_id=? AND period_number=?")
      .get(input.company_id, input.exercise_id, input.period_number);
    if (!period) httpError("El periodo seleccionado no pertenece al ejercicio activo.", 400);
  }

  const checks: Array<[number | null | undefined, string, string]> = [
    [input.center_id, "activity_centers", "centro"],
    [input.group_id, "budget_groups", "grupo"],
    [input.element_id, "budget_elements", "elemento"],
    [input.account_id, "budget_accounts", "cuenta"],
  ];
  for (const [id, table, label] of checks) {
    if (!id) continue;
    const row = database.connection.prepare(`SELECT id FROM ${table} WHERE id=? AND company_id=?`).get(id, input.company_id);
    if (!row) httpError(`El ${label} seleccionado no pertenece a la empresa activa.`, 400);
  }
  if (input.element_id && input.group_id) {
    const linked = database.connection.prepare("SELECT id FROM budget_elements WHERE id=? AND group_id=?").get(input.element_id, input.group_id);
    if (!linked) httpError("El elemento no pertenece al grupo seleccionado.", 400);
  }
  if (input.account_id && input.element_id) {
    const linked = database.connection.prepare("SELECT id FROM budget_accounts WHERE id=? AND element_id=?").get(input.account_id, input.element_id);
    if (!linked) httpError("La cuenta no pertenece al elemento seleccionado.", 400);
  }

  return { company, exercise, original, forecast };
}

function baseSelect() {
  return `p.id period_id,p.period_number,p.name period_name,
    c.id center_id,c.code center_code,c.name center_name,
    g.id group_id,g.code group_code,g.name group_name,
    e.id element_id,e.code element_code,e.name element_name,
    a.id account_id,a.code account_code,a.name account_name,a.nature account_nature`;
}

function toRaw(row: Record<string, unknown>): RawVarianceRow {
  return {
    period_id: Number(row.period_id),
    period_number: Number(row.period_number),
    period_name: String(row.period_name),
    center_id: Number(row.center_id),
    center_code: String(row.center_code),
    center_name: String(row.center_name),
    group_id: Number(row.group_id),
    group_code: String(row.group_code),
    group_name: String(row.group_name),
    element_id: Number(row.element_id),
    element_code: String(row.element_code),
    element_name: String(row.element_name),
    account_id: Number(row.account_id),
    account_code: String(row.account_code),
    account_name: String(row.account_name),
    account_nature: String(row.account_nature),
    budget_type: String(row.budget_type ?? "PRESUPUESTO_ORIGINAL"),
    base_value: roundAmount(finite(row.base_value)),
    comparison_value: nullable(row.comparison_value) === null ? null : roundAmount(finite(row.comparison_value)),
    source_reference: row.source_reference ? String(row.source_reference) : null,
  };
}

function applyFilters(rows: RawVarianceRow[], input: Phase9Input) {
  return rows.filter((row) =>
    (!input.period_number || row.period_number === input.period_number)
    && (!input.center_id || row.center_id === input.center_id)
    && (!input.group_id || row.group_id === input.group_id)
    && (!input.element_id || row.element_id === input.element_id)
    && (!input.account_id || row.account_id === input.account_id)
    && (!input.budget_type || row.budget_type === input.budget_type));
}

function loadRawVariations(database: DatabaseManager, input: Phase9Input): RawVarianceRow[] {
  if (input.comparison === "ORIGINAL_REAL") {
    const rows = database.connection.prepare(`SELECT ${baseSelect()},av.budget_type,
      av.budgeted_value base_value,av.actual_value comparison_value,av.source_reference
      FROM actual_values av
      JOIN budget_periods p ON p.id=av.period_id
      JOIN activity_centers c ON c.id=av.center_id
      JOIN budget_accounts a ON a.id=av.account_id
      JOIN budget_elements e ON e.id=a.element_id
      JOIN budget_groups g ON g.id=e.group_id
      WHERE av.company_id=? AND av.exercise_id=? AND av.original_version_id=?
      ORDER BY p.period_number,c.code,g.code,e.code,a.code,av.budget_type`)
      .all(input.company_id, input.exercise_id, input.original_version_id) as Array<Record<string, unknown>>;
    return applyFilters(rows.map(toRaw), input);
  }

  if (input.comparison === "ORIGINAL_FORECAST") {
    const rows = database.connection.prepare(`SELECT ${baseSelect()},'PRESUPUESTO_ORIGINAL' budget_type,
      fv.original_budget base_value,fv.forecast_value comparison_value,fv.source_reference
      FROM forecast_values fv
      JOIN budget_periods p ON p.id=fv.period_id
      JOIN activity_centers c ON c.id=fv.center_id
      JOIN budget_accounts a ON a.id=fv.account_id
      JOIN budget_elements e ON e.id=a.element_id
      JOIN budget_groups g ON g.id=e.group_id
      WHERE fv.company_id=? AND fv.exercise_id=? AND fv.forecast_version_id=?
      ORDER BY p.period_number,c.code,g.code,e.code,a.code`)
      .all(input.company_id, input.exercise_id, input.forecast_version_id) as Array<Record<string, unknown>>;
    return applyFilters(rows.map(toRaw), input);
  }

  const rows = database.connection.prepare(`SELECT ${baseSelect()},'PRESUPUESTO_ORIGINAL' budget_type,
    fv.forecast_value base_value,COALESCE(av.actual_value,fv.actual_value) comparison_value,
    COALESCE(av.source_reference,fv.source_reference) source_reference
    FROM forecast_values fv
    JOIN budget_periods p ON p.id=fv.period_id
    JOIN activity_centers c ON c.id=fv.center_id
    JOIN budget_accounts a ON a.id=fv.account_id
    JOIN budget_elements e ON e.id=a.element_id
    JOIN budget_groups g ON g.id=e.group_id
    LEFT JOIN actual_values av ON av.original_version_id=fv.original_version_id
      AND av.period_id=fv.period_id AND av.center_id=fv.center_id AND av.account_id=fv.account_id
      AND av.budget_type='PRESUPUESTO_ORIGINAL'
    WHERE fv.company_id=? AND fv.exercise_id=? AND fv.forecast_version_id=?
    ORDER BY p.period_number,c.code,g.code,e.code,a.code`)
    .all(input.company_id, input.exercise_id, input.forecast_version_id) as Array<Record<string, unknown>>;
  return applyFilters(rows.map(toRaw), input);
}

function buildVariationRows(rawRows: RawVarianceRow[], threshold: number): VariationRow[] {
  const totalEffective = rawRows.reduce((sum, row) => sum + Math.abs(row.comparison_value ?? row.base_value), 0);
  const totalImpact = rawRows.reduce((sum, row) => sum + Math.abs(row.comparison_value === null ? 0 : row.comparison_value - row.base_value), 0);
  return rawRows.map((row) => {
    const difference = row.comparison_value === null ? null : roundAmount(row.comparison_value - row.base_value);
    const participation = totalEffective === 0 ? 0 : roundAmount(Math.abs(row.comparison_value ?? row.base_value) / totalEffective * 100, 2);
    const impact = totalImpact === 0 || difference === null ? 0 : roundAmount(Math.abs(difference) / totalImpact * 100, 2);
    return {
      ...row,
      monetary_variation: difference,
      percentage_variation: difference === null ? null : percentage(difference, row.base_value),
      execution_percentage: row.comparison_value === null ? null : percentage(row.comparison_value, row.base_value),
      participation_percentage: participation,
      variance_impact_percentage: impact,
      status: statusFor(row.account_nature, difference),
      material: Math.max(participation, impact) >= threshold,
    };
  });
}

function aggregateRows(
  rows: VariationRow[],
  getId: (row: VariationRow) => number | string,
  getCode: (row: VariationRow) => string,
  getName: (row: VariationRow) => string,
  threshold: number,
  revenueBase: number,
): AggregatedRow[] {
  const map = new Map<string, AggregatedRow>();
  for (const row of rows) {
    const id = getId(row);
    const key = String(id);
    const current = map.get(key) ?? {
      id,
      code: getCode(row),
      name: getName(row),
      base_value: 0,
      comparison_value: 0,
      monetary_variation: 0,
      participation_percentage: 0,
      variance_impact_percentage: 0,
      result_impact: 0,
      profitability_impact: null,
      unfavorable_impact: 0,
      material: false,
      status: "SIN_VARIACION" as VarianceStatus,
    };
    current.base_value += row.base_value;
    current.comparison_value += row.comparison_value ?? 0;
    current.monetary_variation += row.monetary_variation ?? 0;
    current.participation_percentage += row.participation_percentage;
    current.variance_impact_percentage += row.variance_impact_percentage;
    const resultImpact = row.account_nature === "COSTO" || row.account_nature === "GASTO"
      ? -(row.monetary_variation ?? 0)
      : row.account_nature === "INGRESO" ? (row.monetary_variation ?? 0) : 0;
    current.result_impact += resultImpact;
    if (row.status === "DESFAVORABLE") current.unfavorable_impact += Math.abs(row.monetary_variation ?? 0);
    current.material = current.material || row.material;
    map.set(key, current);
  }
  return [...map.values()].map((row) => {
    const rounded = {
      ...row,
      base_value: roundAmount(row.base_value),
      comparison_value: roundAmount(row.comparison_value),
      monetary_variation: roundAmount(row.monetary_variation),
      participation_percentage: roundAmount(row.participation_percentage, 2),
      variance_impact_percentage: roundAmount(row.variance_impact_percentage, 2),
      result_impact: roundAmount(row.result_impact),
      profitability_impact: revenueBase === 0 ? null : roundAmount(row.result_impact / Math.abs(revenueBase) * 100, 2),
      unfavorable_impact: roundAmount(row.unfavorable_impact),
      material: row.material || row.participation_percentage >= threshold || row.variance_impact_percentage >= threshold,
      status: statusFor(row.result_impact >= 0 ? "INGRESO" : "COSTO", row.result_impact),
    };
    return rounded;
  }).sort((a, b) => b.unfavorable_impact - a.unfavorable_impact || Math.abs(b.monetary_variation) - Math.abs(a.monetary_variation));
}

function variationSummary(rows: VariationRow[]) {
  const base = rows.reduce((sum, row) => sum + row.base_value, 0);
  const available = rows.filter((row) => row.comparison_value !== null);
  const compared = available.reduce((sum, row) => sum + Number(row.comparison_value), 0);
  const difference = available.reduce((sum, row) => sum + Number(row.monetary_variation), 0);
  return {
    base_value: roundAmount(base),
    comparison_value: roundAmount(compared),
    monetary_variation: roundAmount(difference),
    percentage_variation: percentage(difference, base),
    execution_percentage: percentage(compared, base),
    participation_total: roundAmount(rows.reduce((sum, row) => sum + row.participation_percentage, 0), 2),
    rows: rows.length,
    rows_with_comparison: available.length,
    coverage_percentage: rows.length ? roundAmount(available.length / rows.length * 100, 2) : 0,
    favorable_count: rows.filter((row) => row.status === "FAVORABLE").length,
    unfavorable_count: rows.filter((row) => row.status === "DESFAVORABLE").length,
    material_count: rows.filter((row) => row.material).length,
  };
}

function buildTrend(database: DatabaseManager, input: Phase9Input, rows: VariationRow[]) {
  const periods = database.connection.prepare("SELECT period_number,name FROM budget_periods WHERE company_id=? AND exercise_id=? ORDER BY period_number")
    .all(input.company_id, input.exercise_id) as Array<{ period_number: number; name: string }>;
  return periods.filter((period) => !input.period_number || period.period_number === input.period_number).map((period) => {
    const selected = rows.filter((row) => row.period_number === Number(period.period_number));
    const base = selected.reduce((sum, row) => sum + row.base_value, 0);
    const available = selected.filter((row) => row.comparison_value !== null);
    const comparison = available.reduce((sum, row) => sum + Number(row.comparison_value), 0);
    const difference = comparison - base;
    return {
      period_number: Number(period.period_number),
      period_name: String(period.name),
      base_value: roundAmount(base),
      comparison_value: roundAmount(comparison),
      monetary_variation: roundAmount(difference),
      percentage_variation: percentage(difference, base),
      execution_percentage: percentage(comparison, base),
      has_data: selected.length > 0,
      comparison_available: available.length > 0,
    };
  });
}

function loadCostSources(database: DatabaseManager, input: Phase9Input): CostSourceRow[] {
  const commonFilters = (row: CostSourceRow) =>
    (!input.period_number || row.period_number === input.period_number)
    && (!input.center_id || row.center_id === input.center_id)
    && (!input.group_id || row.group_id === input.group_id)
    && (!input.element_id || row.element_id === input.element_id)
    && (!input.account_id || row.account_id === input.account_id);
  const costs = database.connection.prepare(`SELECT p.id period_id,p.period_number,p.name period_name,
    c.id center_id,c.code center_code,c.name center_name,g.id group_id,g.code group_code,g.name group_name,
    e.id element_id,e.code element_code,e.name element_name,a.id account_id,a.code account_code,a.name account_name,
    mc.behavior,mc.traceability,mc.cost_category category,(mc.quantity*mc.unit_cost) base_value
    FROM master_costs mc JOIN budget_periods p ON p.id=mc.period_id JOIN activity_centers c ON c.id=mc.center_id
    JOIN budget_accounts a ON a.id=mc.account_id JOIN budget_elements e ON e.id=a.element_id JOIN budget_groups g ON g.id=e.group_id
    WHERE mc.company_id=? AND mc.exercise_id=? AND mc.version_id=?`)
    .all(input.company_id, input.exercise_id, input.original_version_id) as Array<Record<string, unknown>>;
  const expenses = database.connection.prepare(`SELECT p.id period_id,p.period_number,p.name period_name,
    c.id center_id,c.code center_code,c.name center_name,g.id group_id,g.code group_code,g.name group_name,
    e.id element_id,e.code element_code,e.name element_name,a.id account_id,a.code account_code,a.name account_name,
    me.behavior,me.traceability,'GASTOS' category,me.amount base_value
    FROM master_expenses me JOIN budget_periods p ON p.id=me.period_id JOIN activity_centers c ON c.id=me.center_id
    JOIN budget_accounts a ON a.id=me.account_id JOIN budget_elements e ON e.id=a.element_id JOIN budget_groups g ON g.id=e.group_id
    WHERE me.company_id=? AND me.exercise_id=? AND me.version_id=?`)
    .all(input.company_id, input.exercise_id, input.original_version_id) as Array<Record<string, unknown>>;
  return [...costs, ...expenses].map((row) => ({
    period_id: Number(row.period_id), period_number: Number(row.period_number), period_name: String(row.period_name),
    center_id: Number(row.center_id), center_code: String(row.center_code), center_name: String(row.center_name),
    group_id: Number(row.group_id), group_code: String(row.group_code), group_name: String(row.group_name),
    element_id: Number(row.element_id), element_code: String(row.element_code), element_name: String(row.element_name),
    account_id: Number(row.account_id), account_code: String(row.account_code), account_name: String(row.account_name),
    behavior: String(row.behavior) as "FIJO" | "VARIABLE",
    traceability: String(row.traceability) as "DIRECTO" | "INDIRECTO",
    category: String(row.category), base_value: roundAmount(finite(row.base_value)),
  })).filter(commonFilters);
}

function allocateCostRows(sources: CostSourceRow[], variations: VariationRow[]): AllocatedCostRow[] {
  const sourceTotals = new Map<string, number>();
  for (const source of sources) sourceTotals.set(rowKey(source), (sourceTotals.get(rowKey(source)) ?? 0) + source.base_value);
  const variationMap = new Map<string, VariationRow[]>();
  for (const variation of variations) {
    const key = rowKey(variation);
    variationMap.set(key, [...(variationMap.get(key) ?? []), variation]);
  }
  return sources.map((source) => {
    const candidates = variationMap.get(rowKey(source)) ?? [];
    const preferredType = source.category === "GASTOS" ? "GASTOS" : "COSTOS";
    const variation = candidates.find((row) => row.budget_type === preferredType)
      ?? candidates.find((row) => row.budget_type === "PRESUPUESTO_ORIGINAL")
      ?? candidates[0];
    const total = sourceTotals.get(rowKey(source)) ?? 0;
    const share = total === 0 ? 0 : source.base_value / total;
    const allocatedDifference = variation?.monetary_variation === null || variation?.monetary_variation === undefined
      ? 0 : Number(variation.monetary_variation) * share;
    return {
      ...source,
      comparison_value: roundAmount(source.base_value + allocatedDifference),
      monetary_variation: roundAmount(allocatedDifference),
      result_impact: roundAmount(-allocatedDifference),
    };
  });
}

function aggregateCosts(
  rows: AllocatedCostRow[],
  id: (row: AllocatedCostRow) => number | string,
  code: (row: AllocatedCostRow) => string,
  name: (row: AllocatedCostRow) => string,
  threshold: number,
  revenueBase: number,
) {
  const baseTotal = rows.reduce((sum, row) => sum + Math.abs(row.base_value), 0);
  const impactTotal = rows.reduce((sum, row) => sum + Math.abs(row.monetary_variation), 0);
  const map = new Map<string, AggregatedRow>();
  for (const row of rows) {
    const key = String(id(row));
    const current = map.get(key) ?? {
      id: id(row), code: code(row), name: name(row), base_value: 0, comparison_value: 0, monetary_variation: 0,
      participation_percentage: 0, variance_impact_percentage: 0, result_impact: 0, profitability_impact: null,
      unfavorable_impact: 0, material: false, status: "SIN_VARIACION" as VarianceStatus,
    };
    current.base_value += row.base_value;
    current.comparison_value += row.comparison_value;
    current.monetary_variation += row.monetary_variation;
    current.result_impact += row.result_impact;
    if (row.monetary_variation > 0) current.unfavorable_impact += row.monetary_variation;
    map.set(key, current);
  }
  return [...map.values()].map((row) => {
    const participation = baseTotal === 0 ? 0 : Math.abs(row.base_value) / baseTotal * 100;
    const impact = impactTotal === 0 ? 0 : Math.abs(row.monetary_variation) / impactTotal * 100;
    return {
      ...row,
      base_value: roundAmount(row.base_value), comparison_value: roundAmount(row.comparison_value),
      monetary_variation: roundAmount(row.monetary_variation), participation_percentage: roundAmount(participation, 2),
      variance_impact_percentage: roundAmount(impact, 2), result_impact: roundAmount(row.result_impact),
      profitability_impact: revenueBase === 0 ? null : roundAmount(row.result_impact / Math.abs(revenueBase) * 100, 2),
      unfavorable_impact: roundAmount(row.unfavorable_impact), material: Math.max(participation, impact) >= threshold,
      status: row.monetary_variation > 0 ? "DESFAVORABLE" as const : row.monetary_variation < 0 ? "FAVORABLE" as const : "SIN_VARIACION" as const,
    };
  }).sort((a, b) => b.participation_percentage - a.participation_percentage);
}

function snapshotKpis(database: DatabaseManager, descriptor: AnalysisDescriptor | null) {
  if (!descriptor) return { available: false, sales: null, costs: null, expenses: null, result: null, profitability: null, complete: false };
  try {
    const snapshot = buildCorrectedFinancialSnapshot(database, descriptor);
    const profitability = snapshot.ratios.find((ratio) => ratio.name === "Margen neto")?.result ?? null;
    return {
      available: true,
      sales: snapshot.income_statement.sales,
      costs: snapshot.income_statement.cost_of_sales,
      expenses: snapshot.income_statement.operating_expenses,
      result: snapshot.income_statement.net_income,
      profitability,
      complete: snapshot.complete,
    };
  } catch {
    return { available: false, sales: null, costs: null, expenses: null, result: null, profitability: null, complete: false };
  }
}

function fallbackKpis(rows: VariationRow[], side: "base" | "comparison") {
  const value = (row: VariationRow) => side === "base" ? row.base_value : row.comparison_value;
  const available = rows.filter((row) => value(row) !== null);
  if (!available.length) return { available: false, sales: null, costs: null, expenses: null, result: null, profitability: null, complete: false };
  const sales = available.filter((row) => row.account_nature === "INGRESO").reduce((sum, row) => sum + Number(value(row)), 0);
  const costs = available.filter((row) => row.account_nature === "COSTO").reduce((sum, row) => sum + Number(value(row)), 0);
  const expenses = available.filter((row) => row.account_nature === "GASTO").reduce((sum, row) => sum + Number(value(row)), 0);
  const result = sales - costs - expenses;
  return {
    available: true, sales: roundAmount(sales), costs: roundAmount(costs), expenses: roundAmount(expenses), result: roundAmount(result),
    profitability: sales === 0 ? null : roundAmount(result / Math.abs(sales) * 100, 2), complete: false,
  };
}

function scenarioKpis(database: DatabaseManager, input: Phase9Input, rows: VariationRow[]) {
  const period = input.period_number ?? null;
  const originalDescriptor: AnalysisDescriptor = {
    company_id: input.company_id, exercise_id: input.exercise_id, version_id: input.original_version_id,
    source_type: "ORIGINAL", period_number: period,
  };
  const realDescriptor: AnalysisDescriptor = {
    company_id: input.company_id, exercise_id: input.exercise_id, version_id: input.original_version_id,
    source_type: "REAL", period_number: period,
  };
  const forecastDescriptor: AnalysisDescriptor | null = input.forecast_version_id ? {
    company_id: input.company_id, exercise_id: input.exercise_id, version_id: input.forecast_version_id,
    source_type: "FORECAST", period_number: period,
  } : null;
  const originalSnapshot = snapshotKpis(database, originalDescriptor);
  const realSnapshot = snapshotKpis(database, realDescriptor);
  const forecastSnapshot = snapshotKpis(database, forecastDescriptor);
  return {
    original: originalSnapshot.available ? originalSnapshot : fallbackKpis(rows, "base"),
    real: realSnapshot.available ? realSnapshot : input.comparison === "ORIGINAL_REAL" || input.comparison === "FORECAST_REAL" ? fallbackKpis(rows, "comparison") : realSnapshot,
    forecast: forecastSnapshot.available ? forecastSnapshot : input.comparison === "ORIGINAL_FORECAST" ? fallbackKpis(rows, "comparison") : input.comparison === "FORECAST_REAL" ? fallbackKpis(rows, "base") : forecastSnapshot,
  };
}

export function buildPhase9Analysis(database: DatabaseManager, input: Phase9Input) {
  const context = ensureContext(database, input);
  const threshold = input.materiality_threshold ?? 10;
  const rawRows = loadRawVariations(database, input);
  const rows = buildVariationRows(rawRows, threshold);
  const summary = variationSummary(rows);
  const revenueBase = rows.filter((row) => row.account_nature === "INGRESO").reduce((sum, row) => sum + row.base_value, 0);
  const centers = aggregateRows(rows, (row) => row.center_id, (row) => row.center_code, (row) => row.center_name, threshold, revenueBase);
  const groups = aggregateRows(rows, (row) => row.group_id, (row) => row.group_code, (row) => row.group_name, threshold, revenueBase);
  const elements = aggregateRows(rows, (row) => row.element_id, (row) => row.element_code, (row) => row.element_name, threshold, revenueBase);
  const accounts = aggregateRows(rows, (row) => row.account_id, (row) => row.account_code, (row) => row.account_name, threshold, revenueBase);
  const trend = buildTrend(database, input, rows);

  const costSources = loadCostSources(database, input);
  const allocatedCosts = allocateCostRows(costSources, rows);
  const costBase = allocatedCosts.reduce((sum, row) => sum + row.base_value, 0);
  const costComparison = allocatedCosts.reduce((sum, row) => sum + row.comparison_value, 0);
  const costDifference = allocatedCosts.reduce((sum, row) => sum + row.monetary_variation, 0);
  const behavior = aggregateCosts(allocatedCosts, (row) => row.behavior, (row) => row.behavior, (row) => row.behavior === "FIJO" ? "Costos fijos" : "Costos variables", threshold, revenueBase);
  const traceability = aggregateCosts(allocatedCosts, (row) => row.traceability, (row) => row.traceability, (row) => row.traceability === "DIRECTO" ? "Costos directos" : "Costos indirectos", threshold, revenueBase);
  const costCenters = aggregateCosts(allocatedCosts, (row) => row.center_id, (row) => row.center_code, (row) => row.center_name, threshold, revenueBase);
  const costElements = aggregateCosts(allocatedCosts, (row) => row.element_id, (row) => row.element_code, (row) => row.element_name, threshold, revenueBase);
  const costAccounts = aggregateCosts(allocatedCosts, (row) => row.account_id, (row) => row.account_code, (row) => row.account_name, threshold, revenueBase);
  const categories = aggregateCosts(allocatedCosts, (row) => row.category, (row) => row.category, (row) => row.category, threshold, revenueBase);
  const scenarios = scenarioKpis(database, input, rows);

  const comparisonLabels: Record<ComparisonType, [string, string]> = {
    ORIGINAL_REAL: ["Presupuesto original", "Información real"],
    ORIGINAL_FORECAST: ["Presupuesto original", "Forecast"],
    FORECAST_REAL: ["Forecast", "Información real"],
  };
  const [baseLabel, comparisonLabel] = comparisonLabels[input.comparison];
  const warnings: string[] = [];
  if (!rows.length) warnings.push("No existen datos comparables para los filtros seleccionados.");
  if (summary.coverage_percentage < 100 && input.comparison !== "ORIGINAL_FORECAST") warnings.push(`La cobertura de información comparable es ${summary.coverage_percentage} %.`);
  if (!costSources.length) warnings.push("No existen costos o gastos del presupuesto maestro para evaluar comportamiento y trazabilidad.");

  return {
    context: {
      company_id: input.company_id,
      company_name: String(context.company.commercial_name ?? context.company.legal_name),
      exercise_id: input.exercise_id,
      exercise_code: String(context.exercise.code),
      budget_year: Number(context.exercise.budget_year),
      currency_code: String(context.exercise.currency_code),
      currency_symbol: String(context.exercise.currency_symbol),
      original_version_id: input.original_version_id,
      original_version_code: String(context.original.code),
      forecast_version_id: input.forecast_version_id ?? null,
      forecast_version_code: context.forecast ? String(context.forecast.code) : null,
      period_number: input.period_number ?? null,
      comparison: input.comparison,
      base_label: baseLabel,
      comparison_label: comparisonLabel,
      materiality_threshold: threshold,
      filters: {
        center_id: input.center_id ?? null, group_id: input.group_id ?? null, element_id: input.element_id ?? null,
        account_id: input.account_id ?? null, budget_type: input.budget_type ?? null,
      },
    },
    variations: { summary, rows, trend, centers, groups, elements, accounts },
    relevance: {
      summary: {
        base_value: roundAmount(costBase), comparison_value: roundAmount(costComparison), monetary_variation: roundAmount(costDifference),
        percentage_variation: percentage(costDifference, costBase), result_impact: roundAmount(-costDifference),
        profitability_impact: revenueBase === 0 ? null : roundAmount(-costDifference / Math.abs(revenueBase) * 100, 2),
        material_items: costAccounts.filter((row) => row.material).length,
      },
      behavior, traceability, categories, centers: costCenters, elements: costElements, accounts: costAccounts,
    },
    dashboard: {
      scenarios,
      selected_comparison: summary,
      trend,
      critical_centers: centers.slice(0, 10),
      critical_accounts: accounts.slice(0, 10),
      cost_participation: categories,
    },
    warnings,
  };
}

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: Array<{ header: string; key: string; width: number }>, rows: Array<Record<string, unknown>>) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.columns = columns;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };
  rows.forEach((row) => sheet.addRow(row));
  if (columns.length) sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(columns.length).letter}1` };
  return sheet;
}

export function buildPhase9Workbook(result: ReturnType<typeof buildPhase9Analysis>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PresuControl Empresarial";
  workbook.created = new Date();
  workbook.properties.subject = "Variaciones, relevancia de costos y dashboard presupuestal";

  addSheet(workbook, "Resumen", [
    { header: "Indicador", key: "indicator", width: 35 }, { header: "Valor", key: "value", width: 22 },
  ], [
    { indicator: "Empresa", value: result.context.company_name },
    { indicator: "Ejercicio", value: `${result.context.exercise_code} · ${result.context.budget_year}` },
    { indicator: "Comparación", value: `${result.context.base_label} vs ${result.context.comparison_label}` },
    { indicator: "Moneda", value: result.context.currency_code },
    { indicator: "Base", value: result.variations.summary.base_value },
    { indicator: "Comparación", value: result.variations.summary.comparison_value },
    { indicator: "Variación monetaria", value: result.variations.summary.monetary_variation },
    { indicator: "Variación porcentual", value: result.variations.summary.percentage_variation },
    { indicator: "Ejecución porcentual", value: result.variations.summary.execution_percentage },
    { indicator: "Cobertura", value: result.variations.summary.coverage_percentage },
    { indicator: "Partidas materiales", value: result.variations.summary.material_count },
  ]);

  addSheet(workbook, "Variaciones", [
    { header: "Periodo", key: "period", width: 18 }, { header: "Tipo", key: "budget_type", width: 24 },
    { header: "Centro", key: "center", width: 28 }, { header: "Grupo", key: "group", width: 28 },
    { header: "Elemento", key: "element", width: 30 }, { header: "Cuenta", key: "account", width: 34 },
    { header: result.context.base_label, key: "base_value", width: 18 },
    { header: result.context.comparison_label, key: "comparison_value", width: 18 },
    { header: "Variación monetaria", key: "monetary_variation", width: 20 },
    { header: "Variación %", key: "percentage_variation", width: 16 },
    { header: "Ejecución %", key: "execution_percentage", width: 16 },
    { header: "Participación %", key: "participation_percentage", width: 18 },
    { header: "Impacto %", key: "variance_impact_percentage", width: 16 },
    { header: "Estado", key: "status", width: 18 }, { header: "Material", key: "material", width: 12 },
    { header: "Fuente", key: "source_reference", width: 60 },
  ], result.variations.rows.map((row) => ({
    ...row, period: `${row.period_number} · ${row.period_name}`, center: `${row.center_code} · ${row.center_name}`,
    group: `${row.group_code} · ${row.group_name}`, element: `${row.element_code} · ${row.element_name}`,
    account: `${row.account_code} · ${row.account_name}`, material: row.material ? "Sí" : "No",
  })) as Array<Record<string, unknown>>);

  addSheet(workbook, "Tendencia", [
    { header: "Periodo", key: "period", width: 18 }, { header: result.context.base_label, key: "base_value", width: 18 },
    { header: result.context.comparison_label, key: "comparison_value", width: 18 },
    { header: "Variación", key: "monetary_variation", width: 18 }, { header: "Variación %", key: "percentage_variation", width: 16 },
    { header: "Ejecución %", key: "execution_percentage", width: 16 },
  ], result.variations.trend.map((row) => ({ ...row, period: `${row.period_number} · ${row.period_name}` })));

  const rankingColumns = [
    { header: "Código", key: "code", width: 18 }, { header: "Nombre", key: "name", width: 36 },
    { header: "Base", key: "base_value", width: 18 }, { header: "Comparación", key: "comparison_value", width: 18 },
    { header: "Variación", key: "monetary_variation", width: 18 }, { header: "Participación %", key: "participation_percentage", width: 18 },
    { header: "Impacto %", key: "variance_impact_percentage", width: 16 }, { header: "Impacto desfavorable", key: "unfavorable_impact", width: 22 },
    { header: "Impacto resultado", key: "result_impact", width: 20 }, { header: "Material", key: "material_text", width: 12 },
  ];
  addSheet(workbook, "Ranking centros", rankingColumns, result.variations.centers.map((row) => ({ ...row, material_text: row.material ? "Sí" : "No" })));
  addSheet(workbook, "Ranking cuentas", rankingColumns, result.variations.accounts.map((row) => ({ ...row, material_text: row.material ? "Sí" : "No" })));
  addSheet(workbook, "Relevancia costos", [
    { header: "Dimensión", key: "dimension", width: 20 }, { header: "Código", key: "code", width: 18 },
    { header: "Nombre", key: "name", width: 36 }, { header: "Base", key: "base_value", width: 18 },
    { header: "Comparación", key: "comparison_value", width: 18 }, { header: "Variación", key: "monetary_variation", width: 18 },
    { header: "Participación %", key: "participation_percentage", width: 18 }, { header: "Impacto resultado", key: "result_impact", width: 20 },
    { header: "Impacto rentabilidad %", key: "profitability_impact", width: 22 }, { header: "Material", key: "material_text", width: 12 },
  ], [
    ...result.relevance.behavior.map((row) => ({ ...row, dimension: "Comportamiento", material_text: row.material ? "Sí" : "No" })),
    ...result.relevance.traceability.map((row) => ({ ...row, dimension: "Trazabilidad", material_text: row.material ? "Sí" : "No" })),
    ...result.relevance.categories.map((row) => ({ ...row, dimension: "Categoría", material_text: row.material ? "Sí" : "No" })),
    ...result.relevance.centers.map((row) => ({ ...row, dimension: "Centro", material_text: row.material ? "Sí" : "No" })),
    ...result.relevance.elements.map((row) => ({ ...row, dimension: "Elemento", material_text: row.material ? "Sí" : "No" })),
    ...result.relevance.accounts.map((row) => ({ ...row, dimension: "Cuenta", material_text: row.material ? "Sí" : "No" })),
  ] as Array<Record<string, unknown>>);
  addSheet(workbook, "Advertencias", [{ header: "Detalle", key: "detail", width: 110 }], result.warnings.length ? result.warnings.map((detail) => ({ detail })) : [{ detail: "Sin advertencias." }]);
  return workbook;
}

export function getPhase9Options(database: DatabaseManager, companyId: number, exerciseId: number) {
  const exercise = database.connection.prepare("SELECT id FROM budget_exercises WHERE id=? AND company_id=?").get(exerciseId, companyId);
  if (!exercise) httpError("El ejercicio no pertenece a la empresa activa.", 400);
  return {
    centers: database.connection.prepare("SELECT id,code,name,center_type FROM activity_centers WHERE company_id=? AND active=1 ORDER BY code").all(companyId),
    groups: database.connection.prepare("SELECT id,code,name FROM budget_groups WHERE company_id=? AND active=1 ORDER BY code").all(companyId),
    elements: database.connection.prepare("SELECT id,group_id,code,name FROM budget_elements WHERE company_id=? AND active=1 ORDER BY code").all(companyId),
    accounts: database.connection.prepare("SELECT id,element_id,code,name,nature FROM budget_accounts WHERE company_id=? AND active=1 ORDER BY code").all(companyId),
    original_versions: database.connection.prepare("SELECT id,code,name,status FROM budget_versions WHERE company_id=? AND exercise_id=? AND version_type='ORIGINAL' ORDER BY version_number DESC").all(companyId, exerciseId),
    forecast_versions: database.connection.prepare(`SELECT v.id,v.code,v.name,v.status,fp.original_version_id,fp.cutoff_period_number,fp.revision_number
      FROM budget_versions v JOIN forecast_profiles fp ON fp.forecast_version_id=v.id
      WHERE v.company_id=? AND v.exercise_id=? ORDER BY fp.revision_number DESC`).all(companyId, exerciseId),
    budget_types: database.connection.prepare("SELECT DISTINCT budget_type FROM actual_values WHERE company_id=? AND exercise_id=? ORDER BY budget_type").all(companyId, exerciseId),
  };
}
