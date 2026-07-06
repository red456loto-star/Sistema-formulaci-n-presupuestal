export type BudgetType = "PRESUPUESTO_ORIGINAL" | "VENTAS" | "INVENTARIOS" | "COMPRAS" | "PRODUCCION" | "COSTOS" | "GASTOS" | "INVERSIONES" | "RESULTADOS" | "SITUACION_FINANCIERA";
export type SourceType = "REAL_PUBLICADO" | "REAL_INTERNO" | "DERIVADO" | "DEMOSTRATIVO";

export interface Responsible {
  id: number;
  code: string;
  full_name: string;
  position: string;
  email: string;
  active: number;
}

export interface ActualValue {
  id: number;
  company_id: number;
  exercise_id: number;
  original_version_id: number;
  period_id: number;
  period_number: number;
  period_name: string;
  period_status: "ABIERTO" | "CERRADO";
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
  budget_type: BudgetType;
  budgeted_value: number;
  actual_value: number;
  variance: number;
  source_type: SourceType;
  source_reference: string;
  source_period?: string | null;
  source_date?: string | null;
  responsible_id?: number | null;
  responsible_name?: string | null;
  comment?: string | null;
  registered_at: string;
}

export interface ImportPreviewRow {
  row_number: number;
  status: "VALIDO" | "RECHAZADO";
  errors: string[];
  period_id: number | null;
  period_label: string;
  center_id: number | null;
  center_label: string;
  account_id: number | null;
  account_label: string;
  budget_type: BudgetType | string;
  budgeted_value?: number;
  actual_value: number | null;
  source_type: SourceType | string;
  source_reference: string;
  source_period?: string | null;
  source_date?: string | null;
  responsible_id?: number | null;
  comment?: string | null;
}

export interface ImportPreview {
  sheet_name: string;
  header_row: number;
  headers: string[];
  rows: ImportPreviewRow[];
  summary: { rows_read: number; rows_valid: number; rows_rejected: number };
}

export interface ForecastListItem {
  id: number;
  code: string;
  name: string;
  status: "BORRADOR" | "APROBADO" | "CERRADO" | "REEMPLAZADO";
  version_number: number;
  revision_number: number;
  original_version_id: number;
  source_version_code: string;
  cutoff_period_number: number;
  cutoff_period_name: string;
  responsible_name?: string | null;
  observation?: string | null;
  created_at: string;
}

export interface ForecastLine {
  id: number;
  forecast_version_id: number;
  period_id: number;
  period_number: number;
  period_name: string;
  center_id: number;
  center_code: string;
  center_name: string;
  group_code: string;
  group_name: string;
  element_code: string;
  element_name: string;
  account_id: number;
  account_code: string;
  account_name: string;
  original_budget: number;
  actual_value: number | null;
  projected_value: number | null;
  forecast_value: number;
  value_origin: "REAL" | "PROYECCION";
  difference: number;
  comment?: string | null;
  source_reference?: string | null;
  responsible_id?: number | null;
  responsible_name?: string | null;
}

export interface ForecastSummaryMonth {
  period_number: number;
  period_name: string;
  original_budget: number;
  actual_value: number | null;
  forecast_value: number;
  difference: number;
  value_origin: "REAL" | "PROYECCION";
}

export interface ForecastSummary {
  version: ForecastListItem & { company_id: number; exercise_id: number };
  monthly: ForecastSummaryMonth[];
  annual: {
    original_budget: number;
    actual_to_cutoff: number;
    forecast_value: number;
    difference: number;
  };
  complete: boolean;
  line_count: number;
}

export interface ForecastDetail {
  version: ForecastSummary["version"];
  rows: ForecastLine[];
  summary: ForecastSummary;
}
