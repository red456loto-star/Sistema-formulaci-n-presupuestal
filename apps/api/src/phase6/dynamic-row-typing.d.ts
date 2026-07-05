export {};

declare global {
  interface Object {
    item_type?: unknown;
    quantity?: unknown;
    initial_quantity?: unknown;
    desired_final_quantity?: unknown;
    period_number?: unknown;
    period_id?: unknown;
    item_code?: unknown;
    cost_category?: unknown;
    unit_cost?: unknown;
    amount?: unknown;
    financing_source?: unknown;
  }
}

declare module "exceljs" {
  interface WorkbookProperties {
    subject?: string;
  }
}
