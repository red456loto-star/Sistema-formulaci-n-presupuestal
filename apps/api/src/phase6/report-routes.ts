import type { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { getMasterContext, numericId } from "./common";
import {
  getBalanceSheet,
  getIncomeStatement,
  getMasterSummary,
  listCosts,
  listExpenses,
  listInventories,
  listInvestments,
  listProduction,
  listPurchases,
  listSales,
} from "./calculations";

interface ColumnSpec {
  header: string;
  key: string;
  width: number;
}

type ExportRow = Record<string, unknown>;

function getContext(database: DatabaseManager, request: Request) {
  return getMasterContext(
    database,
    numericId(request.query.company_id, "una empresa"),
    numericId(request.query.exercise_id, "un ejercicio"),
    numericId(request.query.version_id, "una versión"),
  );
}

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: ColumnSpec[], rows: ExportRow[]) {
  const worksheet = workbook.addWorksheet(name.slice(0, 31));
  worksheet.columns = columns;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 24;
  for (const row of rows) {
    const values: Record<string, string | number | boolean | null> = {};
    for (const column of columns) {
      const value = row[column.key];
      values[column.key] = value === undefined ? null : value as string | number | boolean | null;
    }
    worksheet.addRow(values);
  }
  worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(columns.length).letter}1` };
  return worksheet;
}

const commonColumns: ColumnSpec[] = [
  { header: "Periodo", key: "period_name", width: 14 },
  { header: "Centro", key: "center_code", width: 14 },
  { header: "Nombre del centro", key: "center_name", width: 24 },
  { header: "Grupo", key: "group_code", width: 14 },
  { header: "Elemento", key: "element_code", width: 14 },
  { header: "Cuenta", key: "account_code", width: 16 },
  { header: "Nombre de cuenta", key: "account_name", width: 28 },
];

function addSalesSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Ventas", [
    ...commonColumns,
    { header: "Producto", key: "item_code", width: 14 },
    { header: "Descripción", key: "item_name", width: 25 },
    { header: "Unidad", key: "unit_code", width: 12 },
    { header: "Cantidad", key: "quantity", width: 14 },
    { header: "Precio", key: "unit_price", width: 14 },
    { header: "Venta presupuestada", key: "sale_amount", width: 20 },
    { header: "Comentario", key: "comment", width: 30 },
  ], rows);
}

function addInventorySheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Inventarios", [
    ...commonColumns,
    { header: "Ítem", key: "item_code", width: 14 },
    { header: "Descripción", key: "item_name", width: 25 },
    { header: "Tipo", key: "item_type", width: 13 },
    { header: "Inventario inicial", key: "initial_quantity", width: 18 },
    { header: "Entradas", key: "entries_quantity", width: 14 },
    { header: "Salidas", key: "exits_quantity", width: 14 },
    { header: "Inventario final calculado", key: "final_quantity", width: 22 },
    { header: "Inventario final deseado", key: "desired_final_quantity", width: 22 },
    { header: "Costo unitario", key: "unit_cost", width: 16 },
    { header: "Valor inventario", key: "inventory_value", width: 18 },
  ], rows);
}

function addPurchasesSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Compras", [
    ...commonColumns,
    { header: "Material", key: "item_code", width: 14 },
    { header: "Descripción", key: "item_name", width: 25 },
    { header: "Necesidades", key: "needs_quantity", width: 15 },
    { header: "Inventario inicial", key: "initial_inventory_quantity", width: 18 },
    { header: "Inventario final deseado", key: "desired_final_quantity", width: 22 },
    { header: "Cantidad de compras", key: "purchase_quantity", width: 20 },
    { header: "Precio de compra", key: "unit_price", width: 17 },
    { header: "Total de compras", key: "purchase_total", width: 18 },
  ], rows);
}

function addProductionSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Produccion", [
    ...commonColumns,
    { header: "Producto", key: "item_code", width: 14 },
    { header: "Descripción", key: "item_name", width: 25 },
    { header: "Ventas previstas", key: "sales_quantity", width: 17 },
    { header: "Inventario final deseado", key: "desired_final_inventory", width: 22 },
    { header: "Inventario inicial", key: "initial_inventory", width: 18 },
    { header: "Resultado fórmula", key: "formula_result", width: 18 },
    { header: "Producción requerida", key: "production_required", width: 20 },
    { header: "Observación", key: "warning", width: 38 },
  ], rows);
}

function addCostsSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Costos", [
    ...commonColumns,
    { header: "Categoría", key: "cost_category", width: 16 },
    { header: "Comportamiento", key: "behavior", width: 17 },
    { header: "Trazabilidad", key: "traceability", width: 16 },
    { header: "Ítem", key: "item_code", width: 14 },
    { header: "Cantidad", key: "quantity", width: 14 },
    { header: "Costo unitario", key: "unit_cost", width: 16 },
    { header: "Costo total", key: "cost_amount", width: 16 },
  ], rows);
}

function addExpensesSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Gastos", [
    ...commonColumns,
    { header: "Comportamiento", key: "behavior", width: 17 },
    { header: "Trazabilidad", key: "traceability", width: 16 },
    { header: "Importe", key: "amount", width: 16 },
    { header: "Comentario", key: "comment", width: 30 },
  ], rows);
}

function addInvestmentsSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Inversiones", [
    ...commonColumns,
    { header: "Descripción", key: "description", width: 30 },
    { header: "Importe", key: "amount", width: 16 },
    { header: "Vida útil (meses)", key: "useful_life_months", width: 18 },
    { header: "Depreciación mensual", key: "monthly_depreciation", width: 20 },
    { header: "Depreciación presupuestada", key: "depreciation_budgeted", width: 24 },
    { header: "Financiamiento", key: "financing_source", width: 17 },
  ], rows);
}

function addIncomeSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Estado de resultados", [
    { header: "Periodo", key: "period_name", width: 15 },
    { header: "Ventas", key: "sales", width: 16 },
    { header: "Materiales", key: "materials", width: 16 },
    { header: "Mano de obra", key: "direct_labor", width: 16 },
    { header: "CIF", key: "manufacturing_overhead", width: 16 },
    { header: "Costo de producción", key: "production_cost", width: 20 },
    { header: "Utilidad bruta", key: "gross_profit", width: 17 },
    { header: "Gastos operativos", key: "operating_expenses", width: 19 },
    { header: "Depreciación", key: "depreciation", width: 16 },
    { header: "Resultado operativo", key: "operating_income", width: 20 },
    { header: "Impuesto", key: "income_tax", width: 16 },
    { header: "Resultado neto", key: "net_income", width: 18 },
  ], rows);
}

function addBalanceSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  addSheet(workbook, "Situacion financiera", [
    { header: "Periodo", key: "period_name", width: 15 },
    { header: "Efectivo", key: "cash", width: 16 },
    { header: "Cuentas por cobrar", key: "receivables", width: 19 },
    { header: "Inventarios", key: "inventory", width: 16 },
    { header: "Propiedad, planta y equipo neto", key: "net_property_plant_equipment", width: 28 },
    { header: "Total activos", key: "total_assets", width: 17 },
    { header: "Cuentas por pagar", key: "accounts_payable", width: 18 },
    { header: "Financiamiento corto plazo", key: "short_term_financing", width: 24 },
    { header: "Deuda largo plazo", key: "long_term_debt", width: 18 },
    { header: "Total pasivos", key: "total_liabilities", width: 17 },
    { header: "Patrimonio", key: "equity", width: 16 },
    { header: "Pasivo + patrimonio", key: "total_liabilities_and_equity", width: 21 },
    { header: "Diferencia", key: "balance_difference", width: 16 },
    { header: "Balanceado", key: "balanced", width: 14 },
  ], rows);
}

export function registerMasterReportRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/master-budget/production", (request: Request, response: Response) => {
    response.json(listProduction(database, getContext(database, request)));
  });

  app.get("/api/master-budget/income-statement", (request: Request, response: Response) => {
    response.json(getIncomeStatement(database, getContext(database, request)));
  });

  app.get("/api/master-budget/balance-sheet", (request: Request, response: Response) => {
    response.json(getBalanceSheet(database, getContext(database, request)));
  });

  app.get("/api/master-budget/summary", (request: Request, response: Response) => {
    response.json(getMasterSummary(database, getContext(database, request)));
  });

  app.get("/api/master-budget/export/:component", async (request: Request, response: Response, next) => {
    try {
      const context = getContext(database, request);
      const component = String(request.params.component);
      const allowed = new Set(["sales", "inventories", "purchases", "production", "costs", "expenses", "investments", "income-statement", "balance-sheet", "all"]);
      if (!allowed.has(component)) httpError("El componente solicitado no admite exportación.", 404);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "PresuControl Empresarial";
      workbook.created = new Date();
      workbook.properties.subject = "Presupuesto maestro";

      if (component === "sales" || component === "all") addSalesSheet(workbook, listSales(database, context));
      if (component === "inventories" || component === "all") addInventorySheet(workbook, listInventories(database, context));
      if (component === "purchases" || component === "all") addPurchasesSheet(workbook, listPurchases(database, context));
      if (component === "production" || component === "all") addProductionSheet(workbook, listProduction(database, context));
      if (component === "costs" || component === "all") addCostsSheet(workbook, listCosts(database, context));
      if (component === "expenses" || component === "all") addExpensesSheet(workbook, listExpenses(database, context));
      if (component === "investments" || component === "all") addInvestmentsSheet(workbook, listInvestments(database, context));
      if (component === "income-statement" || component === "all") addIncomeSheet(workbook, getIncomeStatement(database, context).monthly);
      if (component === "balance-sheet" || component === "all") addBalanceSheet(workbook, getBalanceSheet(database, context).monthly);

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `presupuesto-maestro-${component}-v${context.versionId}.xlsx`;
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      response.end(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  });
}
