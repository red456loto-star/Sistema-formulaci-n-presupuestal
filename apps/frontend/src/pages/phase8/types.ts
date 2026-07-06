export type AnalysisSourceType = "ORIGINAL" | "FORECAST" | "REAL";

export interface AnalysisDescriptor {
  company_id: number;
  exercise_id: number;
  version_id: number;
  source_type: AnalysisSourceType;
  period_number: number | null;
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

export interface VerticalRow {
  statement: "RESULTADOS" | "SITUACION_FINANCIERA";
  key: string;
  label: string;
  value: number | null;
  base_label: string;
  base_value: number;
  percentage: number | null;
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

export interface AnalysisAssumptions {
  tax_rate: number | null;
  cost_of_capital_rate: number | null;
  invested_capital_override: number | null;
  source_reference: string | null;
  notes: string | null;
  saved: boolean;
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
  assumptions: AnalysisAssumptions;
  sources: string[];
  warnings: string[];
  complete: boolean;
}

export interface MappingRow {
  account_id: number;
  account_code: string;
  account_name: string;
  account_nature: string;
  group_code: string;
  element_code: string;
  statement_section: string | null;
  ratio_role: string | null;
  notes: string | null;
}

export interface HorizontalRow {
  statement: "RESULTADOS" | "SITUACION_FINANCIERA";
  key: string;
  label: string;
  initial_value: number | null;
  final_value: number | null;
  monetary_difference: number | null;
  percentage_variation: number | null;
}

export interface HorizontalResult {
  initial: FinancialSnapshot["context"];
  final: FinancialSnapshot["context"];
  rows: HorizontalRow[];
  warnings: string[];
}
