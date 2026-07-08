import { DatabaseManager } from "../../../../packages/database/src/index";
import { ensurePhase11Context, workflowStatus, type Phase11ContextInput } from "./context";

export interface AnalysisRow {
  id: number;
  data_kind: "PRESUPUESTADO" | "REAL";
  center_id: number | null;
  center_code: string | null;
  center_name: string | null;
  element_id: number | null;
  element_code: string | null;
  element_name: string | null;
  account_id: number | null;
  account_code: string | null;
  account_name: string | null;
  account_nature: string | null;
  line_code: string | null;
  line_name: string;
  statement_section: string | null;
  financial_item: string | null;
  cost_behavior: string | null;
  cost_traceability: string | null;
  amount: number;
  wacc_rate: number | null;
}

function round(value: number | null, decimals = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function sum(rows: AnalysisRow[], predicate: (row: AnalysisRow) => boolean) {
  return rows.filter(predicate).reduce((total, row) => total + Number(row.amount || 0), 0);
}

function itemValue(rows: AnalysisRow[], key: string, fallback?: () => number) {
  const matches = rows.filter((row) => String(row.financial_item ?? "").toUpperCase() === key);
  return matches.length ? matches.reduce((total, row) => total + Number(row.amount || 0), 0) : (fallback ? fallback() : 0);
}

function statementSnapshot(rows: AnalysisRow[]) {
  const sales = itemValue(rows, "SALES", () => sum(rows, (row) => row.account_nature === "INGRESO"));
  const costOfSales = itemValue(rows, "COST_OF_SALES", () => sum(rows, (row) => row.account_nature === "COSTO"));
  const grossProfit = itemValue(rows, "GROSS_PROFIT", () => sales - costOfSales);
  const operatingExpenses = itemValue(rows, "OPERATING_EXPENSES", () => sum(rows, (row) => row.account_nature === "GASTO"));
  const operatingIncome = itemValue(rows, "OPERATING_INCOME", () => grossProfit - operatingExpenses);
  const financialExpenses = itemValue(rows, "FINANCIAL_EXPENSES");
  const preTaxIncome = itemValue(rows, "PRE_TAX_INCOME", () => operatingIncome - financialExpenses);
  const incomeTax = itemValue(rows, "INCOME_TAX");
  const netIncome = itemValue(rows, "NET_INCOME", () => preTaxIncome - incomeTax);
  const cash = itemValue(rows, "CASH");
  const receivables = itemValue(rows, "RECEIVABLES");
  const inventory = itemValue(rows, "INVENTORY");
  const currentAssets = itemValue(rows, "CURRENT_ASSETS", () => cash + receivables + inventory);
  const noncurrentAssets = itemValue(rows, "NONCURRENT_ASSETS");
  const totalAssets = itemValue(rows, "TOTAL_ASSETS", () => currentAssets + noncurrentAssets);
  const currentLiabilities = itemValue(rows, "CURRENT_LIABILITIES");
  const noncurrentLiabilities = itemValue(rows, "NONCURRENT_LIABILITIES");
  const totalLiabilities = itemValue(rows, "TOTAL_LIABILITIES", () => currentLiabilities + noncurrentLiabilities);
  const equity = itemValue(rows, "EQUITY", () => totalAssets - totalLiabilities);
  return {
    sales, cost_of_sales: costOfSales, gross_profit: grossProfit, operating_expenses: operatingExpenses,
    operating_income: operatingIncome, financial_expenses: financialExpenses, pre_tax_income: preTaxIncome,
    income_tax: incomeTax, net_income: netIncome, cash, receivables, inventory, current_assets: currentAssets,
    noncurrent_assets: noncurrentAssets, total_assets: totalAssets, current_liabilities: currentLiabilities,
    noncurrent_liabilities: noncurrentLiabilities, total_liabilities: totalLiabilities, equity,
  };
}

const statementLabels: Record<string, string> = {
  sales: "Ventas", cost_of_sales: "Costo de ventas", gross_profit: "Utilidad bruta", operating_expenses: "Gastos operativos",
  operating_income: "Utilidad operativa", financial_expenses: "Gastos financieros", pre_tax_income: "Resultado antes de impuestos",
  income_tax: "Impuesto a la renta", net_income: "Resultado neto", cash: "Efectivo", receivables: "Cuentas por cobrar",
  inventory: "Inventarios", current_assets: "Activos corrientes", noncurrent_assets: "Activos no corrientes", total_assets: "Total activos",
  current_liabilities: "Pasivos corrientes", noncurrent_liabilities: "Pasivos no corrientes", total_liabilities: "Total pasivos", equity: "Patrimonio",
};

function financialAnalysis(rows: AnalysisRow[]) {
  const budgetRows = rows.filter((row) => row.data_kind === "PRESUPUESTADO");
  const realRows = rows.filter((row) => row.data_kind === "REAL");
  const budget = statementSnapshot(budgetRows);
  const real = statementSnapshot(realRows);
  const keys = Object.keys(statementLabels) as Array<keyof typeof budget>;
  const vertical = (snapshot: typeof budget, kind: string) => keys.map((key) => {
    const isBalance = ["cash","receivables","inventory","current_assets","noncurrent_assets","total_assets","current_liabilities","noncurrent_liabilities","total_liabilities","equity"].includes(key);
    const base = isBalance ? snapshot.total_assets : snapshot.sales;
    return { key, label: statementLabels[key], statement: isBalance ? "ESTADO_SITUACION" : "ESTADO_RESULTADOS", amount: round(snapshot[key]), vertical_percentage: round(safeDivide(snapshot[key] * 100, base)) , data_kind: kind };
  });
  const horizontal = keys.map((key) => {
    const variation = real[key] - budget[key];
    return { key, label: statementLabels[key], budgeted: round(budget[key]), real: round(real[key]), variation: round(variation), variation_percentage: round(safeDivide(variation * 100, Math.abs(budget[key]))) };
  });
  const reference = realRows.length ? real : budget;
  const liquidity = safeDivide(reference.current_assets, reference.current_liabilities);
  const quick = safeDivide(reference.current_assets - reference.inventory, reference.current_liabilities);
  const debt = safeDivide(reference.total_liabilities * 100, reference.total_assets);
  const margin = safeDivide(reference.net_income * 100, reference.sales);
  const roa = safeDivide(reference.net_income * 100, reference.total_assets);
  const roe = safeDivide(reference.net_income * 100, reference.equity);
  const assetTurnover = safeDivide(reference.sales, reference.total_assets);
  const equityMultiplier = safeDivide(reference.total_assets, reference.equity);
  const ratios = [
    ["Liquidez corriente", liquidity, "ACTIVO CORRIENTE / PASIVO CORRIENTE"],
    ["Prueba ácida", quick, "(ACTIVO CORRIENTE - INVENTARIOS) / PASIVO CORRIENTE"],
    ["Endeudamiento", debt, "PASIVO TOTAL / ACTIVO TOTAL × 100"],
    ["Margen neto", margin, "RESULTADO NETO / VENTAS × 100"],
    ["ROA", roa, "RESULTADO NETO / ACTIVO TOTAL × 100"],
    ["ROE", roe, "RESULTADO NETO / PATRIMONIO × 100"],
    ["Rotación de activos", assetTurnover, "VENTAS / ACTIVO TOTAL"],
  ].map(([name, result, formula]) => ({ name, result: round(result as number | null), formula }));
  const dupontResult = margin === null || assetTurnover === null || equityMultiplier === null ? null : (margin / 100) * assetTurnover * equityMultiplier * 100;
  const taxRate = reference.pre_tax_income === 0 ? 0 : Math.max(0, Math.min(1, reference.income_tax / Math.abs(reference.pre_tax_income)));
  const nopat = reference.operating_income * (1 - taxRate);
  const investedCapital = reference.total_assets - reference.current_liabilities;
  const wacc = rows.find((row) => row.wacc_rate !== null)?.wacc_rate ?? null;
  const eva = wacc === null ? null : nopat - investedCapital * (wacc / 100);
  return {
    budgeted: budget,
    real,
    active_source: realRows.length ? "REAL" : "PRESUPUESTADO",
    vertical: [...vertical(budget, "PRESUPUESTADO"), ...vertical(real, "REAL")],
    horizontal,
    ratios,
    dupont: { net_margin: round(margin), asset_turnover: round(assetTurnover), equity_multiplier: round(equityMultiplier), roe: round(dupontResult), formula: "Margen neto × Rotación de activos × Multiplicador patrimonial" },
    eva: { nopat: round(nopat), invested_capital: round(investedCapital), wacc_rate: wacc, eva: round(eva), complete: eva !== null },
  };
}

function keyFor(row: AnalysisRow) {
  return [row.center_code ?? row.center_id ?? "SIN_CENTRO", row.element_code ?? row.element_id ?? "SIN_ELEMENTO", row.account_code ?? row.account_id ?? row.line_code ?? row.line_name].join("|");
}

function variationAnalysis(rows: AnalysisRow[]) {
  const groups = new Map<string, { budgeted: number; real: number; sample: AnalysisRow }>();
  for (const row of rows) {
    const key = keyFor(row);
    const current = groups.get(key) ?? { budgeted: 0, real: 0, sample: row };
    if (row.data_kind === "PRESUPUESTADO") current.budgeted += row.amount;
    else current.real += row.amount;
    groups.set(key, current);
  }
  const result = [...groups.values()].map(({ budgeted, real, sample }) => {
    const variation = real - budgeted;
    const unfavorable = sample.account_nature === "INGRESO" ? variation < 0 : ["COSTO","GASTO"].includes(String(sample.account_nature)) ? variation > 0 : Math.abs(variation) > 0;
    return {
      center_id: sample.center_id, center_code: sample.center_code, center_name: sample.center_name,
      element_id: sample.element_id, element_code: sample.element_code, element_name: sample.element_name,
      account_id: sample.account_id, account_code: sample.account_code, account_name: sample.account_name ?? sample.line_name,
      account_nature: sample.account_nature, budgeted: round(budgeted), real: round(real), variation: round(variation),
      variation_percentage: round(safeDivide(variation * 100, Math.abs(budgeted))), execution_percentage: round(safeDivide(real * 100, Math.abs(budgeted))),
      status: budgeted === 0 && real === 0 ? "SIN_MOVIMIENTO" : unfavorable ? "DESFAVORABLE" : variation === 0 ? "SIN_VARIACION" : "FAVORABLE",
    };
  });
  const budgetedTotal = result.reduce((total, row) => total + Number(row.budgeted ?? 0), 0);
  const realTotal = result.reduce((total, row) => total + Number(row.real ?? 0), 0);
  return {
    rows: result.sort((left, right) => Math.abs(Number(right.variation)) - Math.abs(Number(left.variation))),
    summary: { budgeted: round(budgetedTotal), real: round(realTotal), variation: round(realTotal - budgetedTotal), execution_percentage: round(safeDivide(realTotal * 100, Math.abs(budgetedTotal))) },
  };
}

function costAnalysis(rows: AnalysisRow[]) {
  const costRows = rows.filter((row) => ["COSTO","GASTO"].includes(String(row.account_nature)) || ["FIJO","VARIABLE"].includes(String(row.cost_behavior)) || ["DIRECTO","INDIRECTO"].includes(String(row.cost_traceability)));
  const selected = costRows.filter((row) => row.data_kind === (costRows.some((item) => item.data_kind === "REAL") ? "REAL" : "PRESUPUESTADO"));
  const total = selected.reduce((sumValue, row) => sumValue + row.amount, 0);
  const fixed = sum(selected, (row) => row.cost_behavior === "FIJO");
  const variable = sum(selected, (row) => row.cost_behavior === "VARIABLE");
  const direct = sum(selected, (row) => row.cost_traceability === "DIRECTO");
  const indirect = sum(selected, (row) => row.cost_traceability === "INDIRECTO");
  const sales = statementSnapshot(rows.filter((row) => row.data_kind === (rows.some((item) => item.data_kind === "REAL") ? "REAL" : "PRESUPUESTADO"))).sales;
  const contributionMargin = sales - variable;
  const contributionRate = safeDivide(contributionMargin, sales);
  const breakEven = contributionRate === null || contributionRate === 0 ? null : fixed / contributionRate;
  const byCenter = new Map<string, { code: string; name: string; amount: number }>();
  for (const row of selected) {
    const key = row.center_code ?? "SIN_CENTRO";
    const current = byCenter.get(key) ?? { code: key, name: row.center_name ?? "Sin centro", amount: 0 };
    current.amount += row.amount;
    byCenter.set(key, current);
  }
  const byElement = new Map<string, { code: string; name: string; amount: number }>();
  for (const row of selected) {
    const key = row.element_code ?? "SIN_ELEMENTO";
    const current = byElement.get(key) ?? { code: key, name: row.element_name ?? "Sin elemento", amount: 0 };
    current.amount += row.amount;
    byElement.set(key, current);
  }
  return {
    source: selected[0]?.data_kind ?? null,
    summary: { total: round(total), fixed: round(fixed), variable: round(variable), direct: round(direct), indirect: round(indirect), fixed_percentage: round(safeDivide(fixed * 100, total)), variable_percentage: round(safeDivide(variable * 100, total)), direct_percentage: round(safeDivide(direct * 100, total)), indirect_percentage: round(safeDivide(indirect * 100, total)), contribution_margin: round(contributionMargin), break_even_sales: round(breakEven) },
    by_center: [...byCenter.values()].map((item) => ({ ...item, amount: round(item.amount), participation: round(safeDivide(item.amount * 100, total)) })).sort((a, b) => Number(b.amount) - Number(a.amount)),
    by_element: [...byElement.values()].map((item) => ({ ...item, amount: round(item.amount), participation: round(safeDivide(item.amount * 100, total)) })).sort((a, b) => Number(b.amount) - Number(a.amount)),
  };
}

function trend(database: DatabaseManager, input: Phase11ContextInput) {
  const rows = database.connection.prepare(`SELECT p.id period_id,p.period_number,p.name period_name,r.data_kind,SUM(r.amount) amount
    FROM master_data_rows r JOIN budget_periods p ON p.id=r.period_id
    WHERE r.company_id=? AND r.exercise_id=? AND r.version_id=? AND r.budget_type_id=?
    GROUP BY p.id,p.period_number,p.name,r.data_kind ORDER BY p.period_number`)
    .all(input.company_id, input.exercise_id, input.version_id, input.budget_type_id) as Array<Record<string, unknown>>;
  const map = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const periodNumber = Number(row.period_number);
    const current = map.get(periodNumber) ?? { period_id: row.period_id, period_number: periodNumber, period_name: row.period_name, budgeted: 0, real: 0 };
    current[row.data_kind === "REAL" ? "real" : "budgeted"] = Number(row.amount);
    map.set(periodNumber, current);
  }
  return [...map.values()].map((row) => {
    const variation = Number(row.real) - Number(row.budgeted);
    return { ...row, variation: round(variation), execution_percentage: round(safeDivide(Number(row.real) * 100, Math.abs(Number(row.budgeted)))) };
  });
}

export function buildPhase11Analysis(database: DatabaseManager, input: Phase11ContextInput) {
  const context = ensurePhase11Context(database, input);
  const rows = database.connection.prepare(`SELECT r.*,d.wacc_rate FROM master_data_rows r JOIN master_data_sets d ON d.id=r.dataset_id
    WHERE r.company_id=? AND r.exercise_id=? AND r.period_id=? AND r.version_id=? AND r.budget_type_id=? ORDER BY r.data_kind,r.row_order,r.id`)
    .all(input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id) as AnalysisRow[];
  const status = workflowStatus(database, input);
  const financial = financialAnalysis(rows);
  const variations = variationAnalysis(rows);
  const costs = costAnalysis(rows);
  const trendRows = trend(database, input);
  const unfavorable = variations.rows.filter((row) => row.status === "DESFAVORABLE");
  return {
    context: {
      company_name: context.company.commercial_name,
      exercise_code: context.exercise.code,
      budget_year: context.exercise.budget_year,
      period_number: context.period.period_number,
      period_name: context.period.name,
      version_code: context.version.code,
      version_name: context.version.name,
      version_status: context.version.status,
      budget_type_code: context.budgetType.code,
      budget_type_name: context.budgetType.name,
      currency_id: context.exercise.currency_id,
    },
    status,
    financial,
    costs,
    variations,
    dashboard: {
      summary: {
        budgeted: variations.summary.budgeted,
        real: variations.summary.real,
        variation: variations.summary.variation,
        execution_percentage: variations.summary.execution_percentage,
        unfavorable_items: unfavorable.length,
        total_items: variations.rows.length,
      },
      trend: trendRows,
      critical_items: unfavorable.slice(0, 10),
      cost_structure: costs.summary,
      profitability: financial.active_source === "REAL" ? financial.real.net_income : financial.budgeted.net_income,
    },
    warnings: [
      ...(rows.length ? [] : ["No existen datos maestros para el contexto seleccionado."]),
      ...(status.comparison_ready ? [] : ["Para calcular variaciones presupuestado versus real deben registrarse ambos orígenes de información."]),
      ...(status.financial_data_ready ? [] : ["No se identificaron partidas financieras normalizadas para el análisis integral."]),
      ...(financial.eva.complete ? [] : ["El EVA requiere una tasa WACC registrada en los datos maestros."]),
    ],
  };
}
