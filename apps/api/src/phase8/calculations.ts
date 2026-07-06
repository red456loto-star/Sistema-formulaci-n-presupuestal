import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { getMasterContext, roundAmount } from "../phase6/common";
import { getBalanceSheet, getFinancialSettings, getIncomeStatement } from "../phase6/calculations";

export type AnalysisSourceType = "ORIGINAL" | "FORECAST" | "REAL";

export interface AnalysisDescriptor {
  company_id: number;
  exercise_id: number;
  version_id: number;
  source_type: AnalysisSourceType;
  period_number?: number | null;
}

export interface AnalysisContext {
  companyId: number;
  exerciseId: number;
  versionId: number;
  sourceType: AnalysisSourceType;
  periodNumber: number | null;
  company: Record<string, unknown>;
  exercise: Record<string, unknown>;
  version: Record<string, unknown>;
}

export interface IncomeStatementData {
  sales: number;
  cost_of_sales: number;
  gross_profit: number;
  operating_expenses: number;
  operating_income: number;
  pre_tax_income: number;
  income_tax: number | null;
  net_income: number | null;
}

export interface BalanceSheetData {
  cash: number;
  receivables: number;
  inventory: number;
  other_current_assets: number;
  current_assets: number;
  noncurrent_assets: number;
  total_assets: number;
  current_liabilities: number;
  noncurrent_liabilities: number;
  total_liabilities: number;
  equity: number;
  total_liabilities_and_equity: number;
  balance_difference: number;
  balanced: boolean;
}

export interface AssumptionData {
  tax_rate: number | null;
  cost_of_capital_rate: number | null;
  invested_capital_override: number | null;
  source_reference: string | null;
  notes: string | null;
  saved: boolean;
}

export interface RatioResult {
  category: "LIQUIDEZ" | "GESTION" | "SOLVENCIA" | "RENTABILIDAD";
  name: string;
  formula: string;
  variables: Record<string, number | null>;
  result: number | null;
  unit: string;
  interpretation: string;
  sources: string[];
}

export interface VerticalRow {
  statement: "RESULTADOS" | "SITUACION_FINANCIERA";
  key: string;
  label: string;
  value: number | null;
  base_label: string;
  base_value: number;
  percentage: number | null;
}

export interface FinancialSnapshot {
  context: {
    company_id: number;
    company_name: string;
    exercise_id: number;
    exercise_code: string;
    budget_year: number;
    version_id: number;
    version_code: string;
    version_name: string;
    source_type: AnalysisSourceType;
    period_number: number | null;
    period_label: string;
  };
  income_statement: IncomeStatementData;
  balance_sheet: BalanceSheetData;
  vertical_analysis: VerticalRow[];
  ratios: RatioResult[];
  dupont: {
    net_margin: number | null;
    asset_turnover: number | null;
    financial_multiplier: number | null;
    roe: number | null;
    formula: string;
    interpretation: string;
  };
  eva: {
    nopat: number | null;
    invested_capital: number | null;
    cost_of_capital_rate: number | null;
    capital_charge: number | null;
    eva: number | null;
    formula: string;
    interpretation: string;
  };
  assumptions: AssumptionData;
  sources: string[];
  warnings: string[];
  complete: boolean;
}

type MappingSection = "SALES" | "COST_OF_SALES" | "OPERATING_EXPENSE" | "INCOME_TAX" | "CURRENT_ASSET" | "NONCURRENT_ASSET" | "CURRENT_LIABILITY" | "NONCURRENT_LIABILITY" | "EQUITY" | "IGNORE";
type RatioRole = "CASH" | "RECEIVABLES" | "INVENTORY" | "OTHER" | null;

interface FinancialValueRow {
  period_number: number;
  period_name: string;
  account_id: number;
  account_code: string;
  account_name: string;
  account_nature: string;
  value: number;
  statement_section: MappingSection | null;
  ratio_role: RatioRole;
  source_reference: string | null;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nullableFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validateAnalysisContext(database: DatabaseManager, descriptor: AnalysisDescriptor): AnalysisContext {
  const company = database.connection.prepare("SELECT * FROM companies WHERE id=? AND active=1").get(descriptor.company_id) as Record<string, unknown> | undefined;
  if (!company) httpError("La empresa seleccionada no existe o está inactiva.", 400);
  const exercise = database.connection.prepare("SELECT * FROM budget_exercises WHERE id=? AND company_id=?")
    .get(descriptor.exercise_id, descriptor.company_id) as Record<string, unknown> | undefined;
  if (!exercise) httpError("El ejercicio no pertenece a la empresa activa.", 400);
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?")
    .get(descriptor.version_id, descriptor.company_id, descriptor.exercise_id) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece a la empresa y ejercicio activos.", 400);
  const versionType = String(version.version_type);
  if (descriptor.source_type === "FORECAST" && versionType !== "FORECAST") {
    httpError("Para analizar forecast seleccione una versión de tipo FORECAST.", 400);
  }
  if ((descriptor.source_type === "ORIGINAL" || descriptor.source_type === "REAL") && versionType !== "ORIGINAL") {
    httpError("Para analizar presupuesto original o real seleccione una versión ORIGINAL.", 400);
  }
  if (descriptor.source_type === "FORECAST") {
    const profile = database.connection.prepare("SELECT id FROM forecast_profiles WHERE forecast_version_id=?").get(descriptor.version_id);
    if (!profile) httpError("La versión forecast no tiene perfil de revisión asociado.", 409);
  }
  const periodNumber = descriptor.period_number === null || descriptor.period_number === undefined
    ? null
    : Number(descriptor.period_number);
  if (periodNumber !== null && (!Number.isInteger(periodNumber) || periodNumber < 1 || periodNumber > 12)) {
    httpError("El periodo de análisis debe estar entre enero y diciembre.", 400);
  }
  return {
    companyId: descriptor.company_id,
    exerciseId: descriptor.exercise_id,
    versionId: descriptor.version_id,
    sourceType: descriptor.source_type,
    periodNumber,
    company,
    exercise,
    version,
  };
}

export function getAssumptions(database: DatabaseManager, context: AnalysisContext): AssumptionData {
  const saved = database.connection.prepare(`SELECT * FROM financial_analysis_assumptions
    WHERE company_id=? AND exercise_id=? AND version_id=? AND source_type=?`)
    .get(context.companyId, context.exerciseId, context.versionId, context.sourceType) as Record<string, unknown> | undefined;
  if (saved) {
    return {
      tax_rate: nullableFinite(saved.tax_rate),
      cost_of_capital_rate: nullableFinite(saved.cost_of_capital_rate),
      invested_capital_override: nullableFinite(saved.invested_capital_override),
      source_reference: saved.source_reference ? String(saved.source_reference) : null,
      notes: saved.notes ? String(saved.notes) : null,
      saved: true,
    };
  }
  if (context.sourceType === "ORIGINAL") {
    const masterContext = getMasterContext(database, context.companyId, context.exerciseId, context.versionId);
    const settings = getFinancialSettings(database, masterContext);
    return {
      tax_rate: nullableFinite(settings.tax_rate),
      cost_of_capital_rate: null,
      invested_capital_override: null,
      source_reference: "Tasa de impuesto registrada en los supuestos del presupuesto maestro.",
      notes: "El costo de capital todavía no fue registrado para el análisis EVA.",
      saved: false,
    };
  }
  return {
    tax_rate: null,
    cost_of_capital_rate: null,
    invested_capital_override: null,
    source_reference: null,
    notes: "Registre los supuestos necesarios; el sistema no completa variables faltantes.",
    saved: false,
  };
}

function originalSnapshot(database: DatabaseManager, context: AnalysisContext) {
  const masterContext = getMasterContext(database, context.companyId, context.exerciseId, context.versionId);
  const incomeReport = getIncomeStatement(database, masterContext) as {
    monthly: Array<Record<string, unknown>>;
    annual: Record<string, unknown>;
  };
  const balanceReport = getBalanceSheet(database, masterContext) as {
    monthly: Array<Record<string, unknown>>;
    annual: Record<string, unknown> | null;
  };
  const incomeRow = context.periodNumber === null
    ? incomeReport.annual
    : incomeReport.monthly.find((row) => Number(row.period_number) === context.periodNumber);
  const balanceRow = context.periodNumber === null
    ? balanceReport.annual
    : balanceReport.monthly.find((row) => Number(row.period_number) === context.periodNumber);
  if (!incomeRow || !balanceRow) httpError("No existen estados financieros para el periodo seleccionado.", 409);

  const operatingExpenses = finiteNumber(incomeRow.operating_expenses) + finiteNumber(incomeRow.depreciation);
  const income: IncomeStatementData = {
    sales: roundAmount(finiteNumber(incomeRow.sales)),
    cost_of_sales: roundAmount(finiteNumber(incomeRow.production_cost)),
    gross_profit: roundAmount(finiteNumber(incomeRow.gross_profit)),
    operating_expenses: roundAmount(operatingExpenses),
    operating_income: roundAmount(finiteNumber(incomeRow.operating_income)),
    pre_tax_income: roundAmount(finiteNumber(incomeRow.operating_income)),
    income_tax: roundAmount(finiteNumber(incomeRow.income_tax)),
    net_income: roundAmount(finiteNumber(incomeRow.net_income)),
  };
  const cash = finiteNumber(balanceRow.cash);
  const receivables = finiteNumber(balanceRow.receivables);
  const inventory = finiteNumber(balanceRow.inventory);
  const currentAssets = cash + receivables + inventory;
  const noncurrentAssets = finiteNumber(balanceRow.net_property_plant_equipment);
  const currentLiabilities = finiteNumber(balanceRow.accounts_payable) + finiteNumber(balanceRow.short_term_financing);
  const noncurrentLiabilities = finiteNumber(balanceRow.long_term_debt);
  const totalAssets = currentAssets + noncurrentAssets;
  const totalLiabilities = currentLiabilities + noncurrentLiabilities;
  const equity = finiteNumber(balanceRow.equity);
  const totalLiabilitiesAndEquity = totalLiabilities + equity;
  const difference = totalAssets - totalLiabilitiesAndEquity;
  const balance: BalanceSheetData = {
    cash: roundAmount(cash),
    receivables: roundAmount(receivables),
    inventory: roundAmount(inventory),
    other_current_assets: 0,
    current_assets: roundAmount(currentAssets),
    noncurrent_assets: roundAmount(noncurrentAssets),
    total_assets: roundAmount(totalAssets),
    current_liabilities: roundAmount(currentLiabilities),
    noncurrent_liabilities: roundAmount(noncurrentLiabilities),
    total_liabilities: roundAmount(totalLiabilities),
    equity: roundAmount(equity),
    total_liabilities_and_equity: roundAmount(totalLiabilitiesAndEquity),
    balance_difference: roundAmount(difference),
    balanced: Math.abs(difference) < 0.01,
  };
  return {
    income,
    balance,
    sources: [
      `Presupuesto maestro ${String(context.version.code)} (${String(context.exercise.budget_year)}).`,
      "Estado de resultados y estado de situación financiera derivados de ventas, costos, gastos, inventarios e inversiones.",
    ],
    warnings: [] as string[],
  };
}

function mappedRows(database: DatabaseManager, context: AnalysisContext): FinancialValueRow[] {
  if (context.sourceType === "REAL") {
    const rows = database.connection.prepare(`SELECT p.period_number,p.name period_name,
      a.id account_id,a.code account_code,a.name account_name,a.nature account_nature,
      av.actual_value value,av.source_reference,m.statement_section,m.ratio_role
      FROM actual_values av
      JOIN budget_periods p ON p.id=av.period_id
      JOIN budget_accounts a ON a.id=av.account_id
      LEFT JOIN financial_account_mappings m ON m.company_id=av.company_id AND m.account_id=av.account_id
      WHERE av.company_id=? AND av.exercise_id=? AND av.original_version_id=?
      ORDER BY p.period_number,a.code`)
      .all(context.companyId, context.exerciseId, context.versionId) as Array<Record<string, unknown>>;
    return rows.map(toFinancialValueRow);
  }
  const rows = database.connection.prepare(`SELECT p.period_number,p.name period_name,
    a.id account_id,a.code account_code,a.name account_name,a.nature account_nature,
    fv.forecast_value value,fv.source_reference,m.statement_section,m.ratio_role
    FROM forecast_values fv
    JOIN budget_periods p ON p.id=fv.period_id
    JOIN budget_accounts a ON a.id=fv.account_id
    LEFT JOIN financial_account_mappings m ON m.company_id=fv.company_id AND m.account_id=fv.account_id
    WHERE fv.company_id=? AND fv.exercise_id=? AND fv.forecast_version_id=?
    ORDER BY p.period_number,a.code`)
    .all(context.companyId, context.exerciseId, context.versionId) as Array<Record<string, unknown>>;
  return rows.map(toFinancialValueRow);
}

function toFinancialValueRow(row: Record<string, unknown>): FinancialValueRow {
  return {
    period_number: Number(row.period_number),
    period_name: String(row.period_name),
    account_id: Number(row.account_id),
    account_code: String(row.account_code),
    account_name: String(row.account_name),
    account_nature: String(row.account_nature),
    value: finiteNumber(row.value),
    statement_section: row.statement_section ? String(row.statement_section) as MappingSection : null,
    ratio_role: row.ratio_role ? String(row.ratio_role) as Exclude<RatioRole, null> : null,
    source_reference: row.source_reference ? String(row.source_reference) : null,
  };
}

function sumSection(rows: FinancialValueRow[], section: MappingSection) {
  return rows.filter((row) => row.statement_section === section).reduce((sum, row) => sum + row.value, 0);
}

function mappedSnapshot(database: DatabaseManager, context: AnalysisContext, assumptions: AssumptionData) {
  const allRows = mappedRows(database, context);
  if (!allRows.length) {
    httpError(context.sourceType === "REAL" ? "No existe información real para el contexto seleccionado." : "La versión forecast no contiene valores para analizar.", 409);
  }
  const warnings: string[] = [];
  const unmapped = [...new Map(allRows.filter((row) => row.statement_section === null).map((row) => [row.account_id, row])).values()];
  if (unmapped.length) {
    warnings.push(`Existen ${unmapped.length} cuentas sin clasificación financiera: ${unmapped.slice(0, 6).map((row) => row.account_code).join(", ")}${unmapped.length > 6 ? ", ..." : ""}.`);
  }
  const usable = allRows.filter((row) => row.statement_section !== null && row.statement_section !== "IGNORE");
  const incomeRows = context.periodNumber === null
    ? usable
    : usable.filter((row) => row.period_number === context.periodNumber);
  const balanceSections: MappingSection[] = ["CURRENT_ASSET", "NONCURRENT_ASSET", "CURRENT_LIABILITY", "NONCURRENT_LIABILITY", "EQUITY"];
  const balanceCandidates = usable.filter((row) => balanceSections.includes(row.statement_section as MappingSection));
  const latestBalancePeriod = context.periodNumber ?? Math.max(0, ...balanceCandidates.map((row) => row.period_number));
  const balanceRows = balanceCandidates.filter((row) => row.period_number === latestBalancePeriod);
  if (!balanceRows.length) warnings.push("No existen saldos de situación financiera para el periodo analizado.");

  const sales = sumSection(incomeRows, "SALES");
  const cost = sumSection(incomeRows, "COST_OF_SALES");
  const expenses = sumSection(incomeRows, "OPERATING_EXPENSE");
  const gross = sales - cost;
  const operating = gross - expenses;
  const preTax = operating;
  const mappedTaxRows = incomeRows.filter((row) => row.statement_section === "INCOME_TAX");
  const tax = mappedTaxRows.length
    ? mappedTaxRows.reduce((sum, row) => sum + row.value, 0)
    : assumptions.tax_rate === null ? null : Math.max(0, preTax) * assumptions.tax_rate / 100;
  if (!mappedTaxRows.length && assumptions.tax_rate === null) warnings.push("No existe una cuenta de impuesto ni una tasa documentada; el resultado neto no puede calcularse.");
  const net = tax === null ? null : preTax - tax;
  const income: IncomeStatementData = {
    sales: roundAmount(sales),
    cost_of_sales: roundAmount(cost),
    gross_profit: roundAmount(gross),
    operating_expenses: roundAmount(expenses),
    operating_income: roundAmount(operating),
    pre_tax_income: roundAmount(preTax),
    income_tax: tax === null ? null : roundAmount(tax),
    net_income: net === null ? null : roundAmount(net),
  };

  const currentAssetRows = balanceRows.filter((row) => row.statement_section === "CURRENT_ASSET");
  const cash = currentAssetRows.filter((row) => row.ratio_role === "CASH").reduce((sum, row) => sum + row.value, 0);
  const receivables = currentAssetRows.filter((row) => row.ratio_role === "RECEIVABLES").reduce((sum, row) => sum + row.value, 0);
  const inventory = currentAssetRows.filter((row) => row.ratio_role === "INVENTORY").reduce((sum, row) => sum + row.value, 0);
  const currentAssets = currentAssetRows.reduce((sum, row) => sum + row.value, 0);
  const otherCurrent = currentAssets - cash - receivables - inventory;
  const noncurrentAssets = sumSection(balanceRows, "NONCURRENT_ASSET");
  const currentLiabilities = sumSection(balanceRows, "CURRENT_LIABILITY");
  const noncurrentLiabilities = sumSection(balanceRows, "NONCURRENT_LIABILITY");
  const equity = sumSection(balanceRows, "EQUITY");
  const totalAssets = currentAssets + noncurrentAssets;
  const totalLiabilities = currentLiabilities + noncurrentLiabilities;
  const totalLiabilitiesAndEquity = totalLiabilities + equity;
  const difference = totalAssets - totalLiabilitiesAndEquity;
  const balance: BalanceSheetData = {
    cash: roundAmount(cash),
    receivables: roundAmount(receivables),
    inventory: roundAmount(inventory),
    other_current_assets: roundAmount(otherCurrent),
    current_assets: roundAmount(currentAssets),
    noncurrent_assets: roundAmount(noncurrentAssets),
    total_assets: roundAmount(totalAssets),
    current_liabilities: roundAmount(currentLiabilities),
    noncurrent_liabilities: roundAmount(noncurrentLiabilities),
    total_liabilities: roundAmount(totalLiabilities),
    equity: roundAmount(equity),
    total_liabilities_and_equity: roundAmount(totalLiabilitiesAndEquity),
    balance_difference: roundAmount(difference),
    balanced: Math.abs(difference) < 0.01,
  };
  if (!balance.balanced) warnings.push(`El estado de situación financiera presenta una diferencia de ${roundAmount(difference)}.`);
  const sources = [...new Set(allRows.map((row) => row.source_reference).filter((value): value is string => Boolean(value)))];
  return { income, balance, sources, warnings };
}

function safeDivide(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function percent(value: number | null) {
  return value === null ? null : roundAmount(value * 100, 2);
}

function ratioInterpretation(name: string, value: number | null, unit: string) {
  if (value === null) return "No disponible: falta una variable o el denominador es cero.";
  if (name === "Liquidez corriente") return value >= 1 ? "Los activos corrientes cubren las obligaciones corrientes." : "Los activos corrientes no cubren totalmente las obligaciones corrientes.";
  if (name === "Prueba ácida") return value >= 1 ? "La liquidez sin inventarios cubre las obligaciones corrientes." : "La cobertura inmediata de obligaciones corrientes es menor a uno.";
  if (name === "Endeudamiento total") return value <= 50 ? "Menos de la mitad de los activos se financia con pasivos." : "Más de la mitad de los activos se financia con pasivos.";
  if (name === "Margen neto" || name === "ROA" || name === "ROE") return value > 0 ? `El indicador de rentabilidad es positivo (${value.toFixed(2)} ${unit}).` : `El indicador de rentabilidad no es positivo (${value.toFixed(2)} ${unit}).`;
  return `Resultado calculado: ${value.toFixed(2)} ${unit}.`;
}

function buildRatios(income: IncomeStatementData, balance: BalanceSheetData, sources: string[]): RatioResult[] {
  const definitions: Array<Omit<RatioResult, "result" | "interpretation"> & { raw: number | null }> = [
    { category: "LIQUIDEZ", name: "Liquidez corriente", formula: "Activos corrientes / Pasivos corrientes", variables: { activos_corrientes: balance.current_assets, pasivos_corrientes: balance.current_liabilities }, raw: safeDivide(balance.current_assets, balance.current_liabilities), unit: "veces", sources },
    { category: "LIQUIDEZ", name: "Prueba ácida", formula: "(Activos corrientes - Inventarios) / Pasivos corrientes", variables: { activos_corrientes: balance.current_assets, inventarios: balance.inventory, pasivos_corrientes: balance.current_liabilities }, raw: safeDivide(balance.current_assets - balance.inventory, balance.current_liabilities), unit: "veces", sources },
    { category: "GESTION", name: "Rotación de activos", formula: "Ventas / Total activos", variables: { ventas: income.sales, total_activos: balance.total_assets }, raw: safeDivide(income.sales, balance.total_assets), unit: "veces", sources },
    { category: "GESTION", name: "Rotación de inventarios", formula: "Costo de ventas / Inventarios", variables: { costo_ventas: income.cost_of_sales, inventarios: balance.inventory }, raw: safeDivide(income.cost_of_sales, balance.inventory), unit: "veces", sources },
    { category: "GESTION", name: "Rotación de cuentas por cobrar", formula: "Ventas / Cuentas por cobrar", variables: { ventas: income.sales, cuentas_por_cobrar: balance.receivables }, raw: safeDivide(income.sales, balance.receivables), unit: "veces", sources },
    { category: "SOLVENCIA", name: "Endeudamiento total", formula: "Pasivos / Total activos", variables: { pasivos: balance.total_liabilities, total_activos: balance.total_assets }, raw: percent(safeDivide(balance.total_liabilities, balance.total_assets)), unit: "%", sources },
    { category: "SOLVENCIA", name: "Deuda sobre patrimonio", formula: "Pasivos / Patrimonio", variables: { pasivos: balance.total_liabilities, patrimonio: balance.equity }, raw: safeDivide(balance.total_liabilities, balance.equity), unit: "veces", sources },
    { category: "RENTABILIDAD", name: "Margen bruto", formula: "Utilidad bruta / Ventas", variables: { utilidad_bruta: income.gross_profit, ventas: income.sales }, raw: percent(safeDivide(income.gross_profit, income.sales)), unit: "%", sources },
    { category: "RENTABILIDAD", name: "Margen operativo", formula: "Utilidad operativa / Ventas", variables: { utilidad_operativa: income.operating_income, ventas: income.sales }, raw: percent(safeDivide(income.operating_income, income.sales)), unit: "%", sources },
    { category: "RENTABILIDAD", name: "Margen neto", formula: "Resultado neto / Ventas", variables: { resultado_neto: income.net_income, ventas: income.sales }, raw: percent(safeDivide(income.net_income, income.sales)), unit: "%", sources },
    { category: "RENTABILIDAD", name: "ROA", formula: "Resultado neto / Total activos", variables: { resultado_neto: income.net_income, total_activos: balance.total_assets }, raw: percent(safeDivide(income.net_income, balance.total_assets)), unit: "%", sources },
    { category: "RENTABILIDAD", name: "ROE", formula: "Resultado neto / Patrimonio", variables: { resultado_neto: income.net_income, patrimonio: balance.equity }, raw: percent(safeDivide(income.net_income, balance.equity)), unit: "%", sources },
  ];
  return definitions.map(({ raw, ...definition }) => {
    const result = raw === null ? null : roundAmount(raw, 2);
    return { ...definition, result, interpretation: ratioInterpretation(definition.name, result, definition.unit) };
  });
}

function buildVertical(income: IncomeStatementData, balance: BalanceSheetData): VerticalRow[] {
  const incomeRows: Array<[keyof IncomeStatementData, string]> = [
    ["sales", "Ventas"], ["cost_of_sales", "Costos"], ["gross_profit", "Utilidad bruta"],
    ["operating_expenses", "Gastos"], ["operating_income", "Utilidad operativa"],
    ["pre_tax_income", "Resultado antes de impuestos"], ["income_tax", "Impuesto"], ["net_income", "Resultado neto"],
  ];
  const balanceRows: Array<[keyof BalanceSheetData, string]> = [
    ["current_assets", "Activos corrientes"], ["noncurrent_assets", "Activos no corrientes"], ["total_assets", "Total activos"],
    ["current_liabilities", "Pasivos corrientes"], ["noncurrent_liabilities", "Pasivos no corrientes"],
    ["total_liabilities", "Total pasivos"], ["equity", "Patrimonio"], ["total_liabilities_and_equity", "Total pasivo y patrimonio"],
  ];
  const result: VerticalRow[] = incomeRows.map(([key, label]) => ({
    statement: "RESULTADOS",
    key,
    label,
    value: income[key] as number | null,
    base_label: "Ventas",
    base_value: income.sales,
    percentage: income[key] === null ? null : percent(safeDivide(income[key] as number, income.sales)),
  }));
  result.push(...balanceRows.map(([key, label]) => {
    const value = balance[key] as number;
    const liabilitySide = ["current_liabilities", "noncurrent_liabilities", "total_liabilities", "equity", "total_liabilities_and_equity"].includes(key);
    const base = liabilitySide ? balance.total_liabilities_and_equity : balance.total_assets;
    return {
      statement: "SITUACION_FINANCIERA" as const,
      key,
      label,
      value,
      base_label: liabilitySide ? "Total pasivo y patrimonio" : "Total activos",
      base_value: base,
      percentage: percent(safeDivide(value, base)),
    };
  }));
  return result;
}

function periodLabel(database: DatabaseManager, context: AnalysisContext) {
  if (context.periodNumber === null) return "Total anual / cierre del ejercicio";
  const period = database.connection.prepare("SELECT name FROM budget_periods WHERE company_id=? AND exercise_id=? AND period_number=?")
    .get(context.companyId, context.exerciseId, context.periodNumber) as { name: string } | undefined;
  return period ? `${context.periodNumber} · ${period.name}` : String(context.periodNumber);
}

export function buildFinancialSnapshot(database: DatabaseManager, descriptor: AnalysisDescriptor): FinancialSnapshot {
  const context = validateAnalysisContext(database, descriptor);
  const assumptions = getAssumptions(database, context);
  const data = context.sourceType === "ORIGINAL"
    ? originalSnapshot(database, context)
    : mappedSnapshot(database, context, assumptions);
  const sources = [...new Set([
    ...data.sources,
    ...(assumptions.source_reference ? [`Supuestos: ${assumptions.source_reference}`] : []),
  ])];
  const vertical = buildVertical(data.income, data.balance);
  const ratios = buildRatios(data.income, data.balance, sources);
  const netMargin = safeDivide(data.income.net_income, data.income.sales);
  const assetTurnover = safeDivide(data.income.sales, data.balance.total_assets);
  const financialMultiplier = safeDivide(data.balance.total_assets, data.balance.equity);
  const dupontRaw = netMargin === null || assetTurnover === null || financialMultiplier === null
    ? null
    : netMargin * assetTurnover * financialMultiplier;
  const dupont = {
    net_margin: percent(netMargin),
    asset_turnover: assetTurnover === null ? null : roundAmount(assetTurnover, 4),
    financial_multiplier: financialMultiplier === null ? null : roundAmount(financialMultiplier, 4),
    roe: percent(dupontRaw),
    formula: "Margen neto × Rotación de activos × Multiplicador financiero",
    interpretation: dupontRaw === null
      ? "No disponible: faltan ventas, resultado neto, activos o patrimonio, o existe un denominador igual a cero."
      : dupontRaw > 0 ? "La combinación de margen, eficiencia de activos y apalancamiento produce una rentabilidad positiva." : "La rentabilidad Dupont no es positiva.",
  };
  const taxRate = assumptions.tax_rate;
  const nopat = taxRate === null ? null : data.income.operating_income * (1 - taxRate / 100);
  const investedCapital = assumptions.invested_capital_override ?? (data.balance.total_assets - data.balance.current_liabilities);
  const capitalCharge = assumptions.cost_of_capital_rate === null ? null : investedCapital * assumptions.cost_of_capital_rate / 100;
  const evaValue = nopat === null || capitalCharge === null ? null : nopat - capitalCharge;
  const eva = {
    nopat: nopat === null ? null : roundAmount(nopat),
    invested_capital: Number.isFinite(investedCapital) ? roundAmount(investedCapital) : null,
    cost_of_capital_rate: assumptions.cost_of_capital_rate,
    capital_charge: capitalCharge === null ? null : roundAmount(capitalCharge),
    eva: evaValue === null ? null : roundAmount(evaValue),
    formula: "NOPAT − (Capital invertido × Costo de capital)",
    interpretation: evaValue === null
      ? "No disponible: registre una tasa de impuesto y un costo de capital documentados."
      : evaValue > 0 ? "El escenario genera valor económico por encima del costo del capital." : evaValue < 0 ? "El escenario destruye valor económico respecto del costo del capital." : "El escenario cubre exactamente el costo del capital.",
  };
  const warnings = [...data.warnings];
  if (assumptions.cost_of_capital_rate === null) warnings.push("El EVA no se calcula hasta registrar un costo de capital documentado.");
  const complete = data.balance.balanced && data.income.net_income !== null && warnings.every((warning) => !warning.startsWith("Existen") && !warning.startsWith("No existen saldos"));
  return {
    context: {
      company_id: context.companyId,
      company_name: String(context.company.commercial_name ?? context.company.legal_name ?? "Empresa"),
      exercise_id: context.exerciseId,
      exercise_code: String(context.exercise.code),
      budget_year: Number(context.exercise.budget_year),
      version_id: context.versionId,
      version_code: String(context.version.code),
      version_name: String(context.version.name),
      source_type: context.sourceType,
      period_number: context.periodNumber,
      period_label: periodLabel(database, context),
    },
    income_statement: data.income,
    balance_sheet: data.balance,
    vertical_analysis: vertical,
    ratios,
    dupont,
    eva,
    assumptions,
    sources,
    warnings,
    complete,
  };
}

export function horizontalAnalysis(initial: FinancialSnapshot, final: FinancialSnapshot) {
  if (initial.context.company_id !== final.context.company_id) {
    httpError("El análisis horizontal solo compara información de una misma empresa.", 400);
  }
  const incomeLabels: Record<keyof IncomeStatementData, string> = {
    sales: "Ventas",
    cost_of_sales: "Costos",
    gross_profit: "Utilidad bruta",
    operating_expenses: "Gastos",
    operating_income: "Utilidad operativa",
    pre_tax_income: "Resultado antes de impuestos",
    income_tax: "Impuesto",
    net_income: "Resultado neto",
  };
  const balanceLabels: Partial<Record<keyof BalanceSheetData, string>> = {
    current_assets: "Activos corrientes",
    noncurrent_assets: "Activos no corrientes",
    total_assets: "Total activos",
    current_liabilities: "Pasivos corrientes",
    noncurrent_liabilities: "Pasivos no corrientes",
    total_liabilities: "Total pasivos",
    equity: "Patrimonio",
    total_liabilities_and_equity: "Total pasivo y patrimonio",
  };
  const makeRow = (statement: string, key: string, label: string, start: number | null, end: number | null) => {
    const difference = start === null || end === null ? null : end - start;
    const variation = difference === null || start === 0 ? null : difference / Math.abs(start) * 100;
    return {
      statement,
      key,
      label,
      initial_value: start,
      final_value: end,
      monetary_difference: difference === null ? null : roundAmount(difference),
      percentage_variation: variation === null ? null : roundAmount(variation, 2),
    };
  };
  const rows = (Object.keys(incomeLabels) as Array<keyof IncomeStatementData>).map((key) =>
    makeRow("RESULTADOS", key, incomeLabels[key], initial.income_statement[key], final.income_statement[key]));
  rows.push(...(Object.keys(balanceLabels) as Array<keyof BalanceSheetData>).map((key) =>
    makeRow("SITUACION_FINANCIERA", key, String(balanceLabels[key]), initial.balance_sheet[key] as number, final.balance_sheet[key] as number)));
  return {
    initial: initial.context,
    final: final.context,
    rows,
    warnings: [...initial.warnings.map((item) => `Inicial: ${item}`), ...final.warnings.map((item) => `Final: ${item}`)],
  };
}
