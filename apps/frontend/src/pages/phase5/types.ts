export interface CatalogItem {
  id: number;
  code: string;
  name: string;
  active: number;
}

export interface Responsible extends CatalogItem {
  full_name: string;
  position: string;
  email: string;
}

export interface Currency extends CatalogItem {
  symbol: string;
  decimals: number;
}

export interface BudgetAccount extends CatalogItem {
  element_id: number;
  nature: string;
  movement_type: string;
}

export interface BudgetElement extends CatalogItem {
  group_id: number;
  accounts: BudgetAccount[];
}

export interface BudgetGroup extends CatalogItem {
  elements: BudgetElement[];
}

export interface ActivityCenter extends CatalogItem {
  responsible_id: number;
  responsible_name: string;
  responsible_email: string;
  budget: BudgetGroup[];
}

export interface OrganizationHierarchy {
  organizational: Array<{ id: number; name: string; centers: ActivityCenter[] }>;
  budget: BudgetGroup[];
}

export interface MonthlyValue {
  id: number;
  period_id: number;
  period_number: number;
  period_name: string;
  period_status: "ABIERTO" | "CERRADO";
  budgeted_value: number;
  real_value: number | null;
}

export interface ProjectionValue {
  id: number;
  projection_year_id: number;
  sequence: number;
  year: number;
  description: string;
  budgeted_value: number;
  real_value: number | null;
}

export interface OriginalBudgetLine {
  id: number;
  company_id: number;
  exercise_id: number;
  version_id: number;
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
  currency_id: number;
  currency_code: string;
  currency_symbol: string;
  currency_decimals: number;
  unit_id?: number | null;
  unit_code?: string | null;
  responsible_id?: number | null;
  responsible_name?: string | null;
  comment?: string | null;
  support?: string | null;
  source_text?: string | null;
  annual_budgeted: number;
  annual_real: number | null;
  annual_comparable_budget: number | null;
  annual_variance: number | null;
  complete: boolean;
  monthly_values: MonthlyValue[];
  projections: ProjectionValue[];
}

export interface OriginalSummary {
  line_count: number;
  total_budgeted: number;
  total_real: number | null;
  comparable_budget: number | null;
  variance: number | null;
  complete_lines: number;
  can_approve: boolean;
}
