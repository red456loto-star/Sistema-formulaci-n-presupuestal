export type ComparisonType = "ORIGINAL_REAL" | "ORIGINAL_FORECAST" | "FORECAST_REAL";
export type VarianceStatus = "FAVORABLE" | "DESFAVORABLE" | "SIN_VARIACION" | "NEUTRAL" | "SIN_DATO";

export interface Phase9Options {
  centers: Array<{ id: number; code: string; name: string; center_type: string }>;
  groups: Array<{ id: number; code: string; name: string }>;
  elements: Array<{ id: number; group_id: number; code: string; name: string }>;
  accounts: Array<{ id: number; element_id: number; code: string; name: string; nature: string }>;
  original_versions: Array<{ id: number; code: string; name: string; status: string }>;
  forecast_versions: Array<{ id: number; code: string; name: string; status: string; original_version_id: number; cutoff_period_number: number; revision_number: number }>;
  budget_types: Array<{ budget_type: string }>;
}

export interface Phase9Filters {
  company_id: number;
  exercise_id: number;
  original_version_id: number;
  forecast_version_id: number | null;
  period_number: number | null;
  center_id: number | null;
  group_id: number | null;
  element_id: number | null;
  account_id: number | null;
  budget_type: string | null;
  comparison: ComparisonType;
  materiality_threshold: number;
}

export interface VariationSummary {
  base_value: number;
  comparison_value: number;
  monetary_variation: number;
  percentage_variation: number | null;
  execution_percentage: number | null;
  participation_total: number;
  rows: number;
  rows_with_comparison: number;
  coverage_percentage: number;
  favorable_count: number;
  unfavorable_count: number;
  material_count: number;
}

export interface VariationRow {
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
  monetary_variation: number | null;
  percentage_variation: number | null;
  execution_percentage: number | null;
  participation_percentage: number;
  variance_impact_percentage: number;
  status: VarianceStatus;
  material: boolean;
  source_reference: string | null;
}

export interface TrendRow {
  period_number: number;
  period_name: string;
  base_value: number;
  comparison_value: number;
  monetary_variation: number;
  percentage_variation: number | null;
  execution_percentage: number | null;
  has_data: boolean;
  comparison_available: boolean;
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

export interface ScenarioKpis {
  available: boolean;
  sales: number | null;
  costs: number | null;
  expenses: number | null;
  result: number | null;
  profitability: number | null;
  complete: boolean;
}

export interface Phase9Analysis {
  context: {
    company_id: number;
    company_name: string;
    exercise_id: number;
    exercise_code: string;
    budget_year: number;
    currency_code: string;
    currency_symbol: string;
    original_version_id: number;
    original_version_code: string;
    forecast_version_id: number | null;
    forecast_version_code: string | null;
    period_number: number | null;
    comparison: ComparisonType;
    base_label: string;
    comparison_label: string;
    materiality_threshold: number;
  };
  variations: {
    summary: VariationSummary;
    rows: VariationRow[];
    trend: TrendRow[];
    centers: AggregatedRow[];
    groups: AggregatedRow[];
    elements: AggregatedRow[];
    accounts: AggregatedRow[];
  };
  relevance: {
    summary: {
      base_value: number;
      comparison_value: number;
      monetary_variation: number;
      percentage_variation: number | null;
      result_impact: number;
      profitability_impact: number | null;
      material_items: number;
    };
    behavior: AggregatedRow[];
    traceability: AggregatedRow[];
    categories: AggregatedRow[];
    centers: AggregatedRow[];
    elements: AggregatedRow[];
    accounts: AggregatedRow[];
  };
  dashboard: {
    scenarios: { original: ScenarioKpis; real: ScenarioKpis; forecast: ScenarioKpis };
    selected_comparison: VariationSummary;
    trend: TrendRow[];
    critical_centers: AggregatedRow[];
    critical_accounts: AggregatedRow[];
    cost_participation: AggregatedRow[];
  };
  warnings: string[];
}
