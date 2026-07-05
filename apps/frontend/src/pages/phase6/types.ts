export interface Option { id: number; label: string; }

export interface MasterItem {
  id: number;
  company_id: number;
  code: string;
  name: string;
  item_type: "PRODUCTO" | "MATERIAL";
  unit_id: number | null;
  unit_code?: string | null;
  unit_name?: string | null;
  active: number;
}

export interface HierarchyAccount {
  id: number;
  code: string;
  name: string;
  element_id: number;
}

export interface HierarchyElement {
  id: number;
  code: string;
  name: string;
  group_id: number;
  accounts: HierarchyAccount[];
}

export interface HierarchyGroup {
  id: number;
  code: string;
  name: string;
  elements: HierarchyElement[];
}

export interface HierarchyCenter {
  id: number;
  code: string;
  name: string;
  center_type: "PRODUCTIVO" | "APOYO" | "COMERCIAL" | "ADMINISTRATIVO";
  budget: HierarchyGroup[];
}

export interface OrganizationHierarchy {
  organizational: Array<{ id: number; code: string; name: string; centers: HierarchyCenter[] }>;
  budget: HierarchyGroup[];
}

export interface MasterDimensionRow {
  id: number;
  period_id: number;
  period_number: number;
  period_name: string;
  period_status: "ABIERTO" | "CERRADO";
  center_id: number;
  center_code: string;
  center_name: string;
  center_type: string;
  account_id: number;
  account_code: string;
  account_name: string;
  group_code: string;
  group_name: string;
  element_code: string;
  element_name: string;
  comment?: string | null;
}

export interface SaleRow extends MasterDimensionRow {
  item_id: number;
  item_code: string;
  item_name: string;
  unit_code?: string | null;
  quantity: number;
  unit_price: number;
  sale_amount: number;
}

export interface InventoryRow extends MasterDimensionRow {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: "PRODUCTO" | "MATERIAL";
  initial_quantity: number;
  entries_quantity: number;
  exits_quantity: number;
  desired_final_quantity: number;
  unit_cost: number;
  final_quantity: number;
  inventory_value: number;
  desired_inventory_value: number;
}

export interface PurchaseRow extends MasterDimensionRow {
  item_id: number;
  item_code: string;
  item_name: string;
  needs_quantity: number;
  initial_inventory_quantity: number;
  desired_final_quantity: number;
  unit_price: number;
  purchase_quantity: number;
  purchase_total: number;
}

export interface ProductionRow extends Omit<MasterDimensionRow, "id" | "comment"> {
  item_id: number;
  item_code: string;
  item_name: string;
  unit_code?: string | null;
  sales_quantity: number;
  initial_inventory: number;
  desired_final_inventory: number;
  formula_result: number;
  production_required: number;
  warning: string | null;
}

export interface CostRow extends MasterDimensionRow {
  item_id: number | null;
  item_code?: string | null;
  item_name?: string | null;
  cost_category: "MATERIALES" | "MANO_OBRA" | "CIF";
  behavior: "FIJO" | "VARIABLE";
  traceability: "DIRECTO" | "INDIRECTO";
  quantity: number;
  unit_cost: number;
  cost_amount: number;
}

export interface ExpenseRow extends MasterDimensionRow {
  behavior: "FIJO" | "VARIABLE";
  traceability: "DIRECTO" | "INDIRECTO";
  amount: number;
}

export interface InvestmentRow extends MasterDimensionRow {
  description: string;
  amount: number;
  useful_life_months: number | null;
  financing_source: "CAJA" | "DEUDA" | "CAPITAL";
  monthly_depreciation: number;
  depreciation_budgeted: number;
}

export interface FinancialSettings {
  tax_rate: number;
  collection_rate: number;
  payment_rate: number;
  opening_cash: number;
  opening_receivables: number;
  opening_ppe: number;
  opening_payables: number;
  opening_debt: number;
  notes: string | null;
}

export interface IncomeRow {
  period_id: number;
  period_number: number;
  period_name: string;
  sales: number;
  materials: number;
  direct_labor: number;
  manufacturing_overhead: number;
  production_cost: number;
  gross_profit: number;
  operating_expenses: number;
  depreciation: number;
  operating_income: number;
  income_tax: number;
  net_income: number;
}

export interface IncomeStatement {
  settings: FinancialSettings;
  monthly: IncomeRow[];
  annual: Omit<IncomeRow, "period_id" | "period_number" | "period_name">;
}

export interface BalanceRow {
  period_id: number;
  period_number: number;
  period_name: string;
  cash: number;
  receivables: number;
  inventory: number;
  net_property_plant_equipment: number;
  total_assets: number;
  accounts_payable: number;
  short_term_financing: number;
  long_term_debt: number;
  total_liabilities: number;
  equity: number;
  total_liabilities_and_equity: number;
  balance_difference: number;
  balanced: boolean;
}

export interface BalanceSheet {
  settings: FinancialSettings;
  opening: { inventory: number; assets: number; liabilities: number; equity: number };
  monthly: BalanceRow[];
  annual: BalanceRow | null;
}

export interface MasterSummary {
  sales_total: number;
  inventory_final_value: number;
  purchases_total: number;
  production_units: number;
  production_cost: number;
  expenses_total: number;
  investments_total: number;
  net_income: number;
  balance_ok: boolean;
  counts: Record<string, number>;
}
