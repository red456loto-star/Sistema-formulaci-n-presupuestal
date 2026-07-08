export type DataKind = "PRESUPUESTADO" | "REAL";

export interface MasterDataset {
  id: number;
  company_id: number;
  exercise_id: number;
  period_id: number;
  version_id: number;
  budget_type_id: number;
  data_kind: DataKind;
  source_file: string | null;
  source_label: string | null;
  source_url: string | null;
  source_period: string | null;
  operator_name: string | null;
  wacc_rate: number | null;
  notes: string | null;
  row_count: number;
  total_amount: number;
  budget_type_code: string;
  budget_type_name: string;
  period_number: number;
  period_name: string;
  version_code: string;
  version_name: string;
}

export interface MasterRow {
  id: number;
  dataset_id: number;
  data_kind: DataKind;
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
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  source_reference: string | null;
  notes: string | null;
}

export interface MasterDataResponse {
  datasets: MasterDataset[];
  rows: MasterRow[];
}

export interface InspectRow extends Omit<MasterRow, "id" | "dataset_id" | "data_kind"> {
  row_number: number;
  warnings: string[];
}

export interface InspectResponse {
  file_name: string;
  sheet_name: string;
  sheets: Array<{ name: string; row_count: number }>;
  header_row: number;
  rows: InspectRow[];
  summary: { rows_read: number; rows_valid: number; rows_observed: number };
}

export interface Phase11Analysis {
  context: {
    company_name: string;
    exercise_code: string;
    budget_year: number;
    period_number: number;
    period_name: string;
    version_code: string;
    version_name: string;
    version_status: string;
    budget_type_code: string;
    budget_type_name: string;
    currency_id: number;
  };
  status: {
    master_data_ready: boolean;
    budgeted_ready: boolean;
    real_ready: boolean;
    comparison_ready: boolean;
    financial_data_ready: boolean;
    cost_data_ready: boolean;
  };
  financial: {
    budgeted: Record<string, number>;
    real: Record<string, number>;
    active_source: string;
    vertical: Array<{ key: string; label: string; statement: string; amount: number | null; vertical_percentage: number | null; data_kind: string }>;
    horizontal: Array<{ key: string; label: string; budgeted: number | null; real: number | null; variation: number | null; variation_percentage: number | null }>;
    ratios: Array<{ name: string; result: number | null; formula: string }>;
    dupont: { net_margin: number | null; asset_turnover: number | null; equity_multiplier: number | null; roe: number | null; formula: string };
    eva: { nopat: number | null; invested_capital: number | null; wacc_rate: number | null; eva: number | null; complete: boolean };
  };
  costs: {
    source: string | null;
    summary: Record<string, number | null>;
    by_center: Array<{ code: string; name: string; amount: number | null; participation: number | null }>;
    by_element: Array<{ code: string; name: string; amount: number | null; participation: number | null }>;
  };
  variations: {
    rows: Array<Record<string, unknown>>;
    summary: { budgeted: number | null; real: number | null; variation: number | null; execution_percentage: number | null };
  };
  dashboard: {
    summary: { budgeted: number | null; real: number | null; variation: number | null; execution_percentage: number | null; unfavorable_items: number; total_items: number };
    trend: Array<Record<string, unknown>>;
    critical_items: Array<Record<string, unknown>>;
    cost_structure: Record<string, number | null>;
    profitability: number | null;
  };
  warnings: string[];
}

export interface Phase11Proposal {
  id: number;
  company_id: number;
  exercise_id: number;
  period_id: number;
  version_id: number;
  budget_type_id: number;
  center_id: number | null;
  element_id: number | null;
  account_id: number | null;
  problem: string;
  evidence_value: number;
  evidence_unit: string;
  evidence_text: string;
  probable_cause: string;
  proposed_action: string;
  expected_impact: number;
  profitability_impact: number | null;
  responsible_id: number;
  priority: "ALTA" | "MEDIA" | "BAJA";
  due_date: string;
  status: "PROPUESTA" | "APROBADA" | "EN_EJECUCION" | "IMPLEMENTADA" | "DESCARTADA";
  center_code?: string;
  center_name?: string;
  element_code?: string;
  element_name?: string;
  account_code?: string;
  account_name?: string;
  responsible_name: string;
  responsible_position: string;
}
