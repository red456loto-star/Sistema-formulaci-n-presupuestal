import type { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { importMasterData, type MasterDataImportInput, type MasterDataRowInput } from "./master-data";
import { suggestPhase11Proposals } from "./proposals";

const headerAliases: Record<string, string[]> = {
  center_code: ["center_code","centro_codigo","codigo_centro","codigo_del_centro","centro"],
  center_name: ["center_name","centro_nombre","nombre_centro","nombre_del_centro"],
  element_code: ["element_code","elemento_codigo","codigo_elemento","codigo_del_elemento","elemento"],
  element_name: ["element_name","elemento_nombre","nombre_elemento","nombre_del_elemento"],
  account_code: ["account_code","cuenta_codigo","codigo_cuenta","codigo_de_cuenta","cuenta"],
  account_name: ["account_name","cuenta_nombre","nombre_cuenta","nombre_de_cuenta"],
  account_nature: ["account_nature","naturaleza","naturaleza_cuenta","naturaleza_de_cuenta"],
  line_code: ["line_code","codigo_linea","codigo_de_linea","codigo"],
  line_name: ["line_name","nombre_linea","nombre_de_linea","partida","descripcion","concepto"],
  statement_section: ["statement_section","seccion_estado","seccion_de_estado","estado_financiero","seccion"],
  financial_item: ["financial_item","partida_financiera","item_financiero","rubro_financiero","partida_financiera_normalizada"],
  cost_behavior: ["cost_behavior","comportamiento_costo","comportamiento_del_costo","costo_fijo_variable"],
  cost_traceability: ["cost_traceability","trazabilidad_costo","trazabilidad_del_costo","costo_directo_indirecto"],
  quantity: ["quantity","cantidad"], unit_price: ["unit_price","precio_unitario","costo_unitario"],
  amount: ["amount","importe","monto","valor","total"],
  source_reference: ["source_reference","fuente","referencia","fuente_o_referencia"], notes: ["notes","observaciones","nota"],
};

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function text(value: unknown) { const result = String(value ?? "").trim(); return result || null; }
function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(String(value).replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(result) ? result : null;
}
function cellValue(cell: ExcelJS.Cell) {
  const value = cell.value as unknown;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("result" in record) return record.result;
    if ("text" in record) return record.text;
    if ("richText" in record) return ((record.richText as Array<{ text: string }>) ?? []).map((item) => item.text).join("");
  }
  return value;
}
function enumValue(value: unknown, allowed: string[]) {
  const normalized = normalize(value).toUpperCase();
  return allowed.includes(normalized) ? normalized : null;
}

async function inspectWorkbook(input: { file_name: string; content_base64: string; sheet_name?: string | null }) {
  if (!input.file_name.toLowerCase().endsWith(".xlsx")) httpError("Solo se admiten archivos .xlsx.", 400);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(input.content_base64, "base64") as any);
  const sheet = input.sheet_name ? workbook.getWorksheet(input.sheet_name) : workbook.worksheets[0];
  if (!sheet) httpError("El archivo no contiene una hoja válida.", 400);
  let headerRow = 0;
  let mapping: Record<string, number> = {};
  for (let rowNumber = 1; rowNumber <= Math.min(15, sheet.rowCount); rowNumber += 1) {
    const values = (sheet.getRow(rowNumber).values as unknown[]).slice(1).map(normalize);
    const candidate: Record<string, number> = {};
    for (const [key, aliases] of Object.entries(headerAliases)) {
      const index = values.findIndex((value) => aliases.includes(value));
      if (index >= 0) candidate[key] = index + 1;
    }
    if (candidate.line_name && candidate.amount) { headerRow = rowNumber; mapping = candidate; break; }
  }
  if (!headerRow) httpError("La hoja debe contener como mínimo nombre de línea e importe.", 400);
  const rows: Array<Record<string, unknown>> = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const get = (key: string) => mapping[key] ? cellValue(row.getCell(mapping[key])) : null;
    const lineName = text(get("line_name"));
    const amount = numberValue(get("amount"));
    if (!lineName && amount === null) continue;
    const warnings: string[] = [];
    if (!lineName) warnings.push("Falta el nombre de línea.");
    if (amount === null) warnings.push("El importe no es numérico.");
    rows.push({
      row_number: rowNumber,
      center_code: text(get("center_code")), center_name: text(get("center_name")),
      element_code: text(get("element_code")), element_name: text(get("element_name")),
      account_code: text(get("account_code")), account_name: text(get("account_name")),
      account_nature: enumValue(get("account_nature"), ["INGRESO","COSTO","GASTO","ACTIVO","PASIVO","PATRIMONIO"]),
      line_code: text(get("line_code")), line_name: lineName ?? "",
      statement_section: enumValue(get("statement_section"), ["PRESUPUESTO","ESTADO_RESULTADOS","ESTADO_SITUACION","FLUJO_EFECTIVO"]),
      financial_item: text(get("financial_item"))?.toUpperCase().replace(/\s+/g, "_") ?? null,
      cost_behavior: enumValue(get("cost_behavior"), ["FIJO","VARIABLE","NO_APLICA"]),
      cost_traceability: enumValue(get("cost_traceability"), ["DIRECTO","INDIRECTO","NO_APLICA"]),
      quantity: numberValue(get("quantity")), unit_price: numberValue(get("unit_price")), amount: amount ?? 0,
      source_reference: text(get("source_reference")), notes: text(get("notes")), warnings,
    });
  }
  return {
    file_name: input.file_name, sheet_name: sheet.name,
    sheets: workbook.worksheets.map((item) => ({ name: item.name, row_count: item.rowCount })), header_row: headerRow, rows,
    summary: { rows_read: rows.length, rows_valid: rows.filter((row) => (row.warnings as string[]).length === 0).length, rows_observed: rows.filter((row) => (row.warnings as string[]).length > 0).length },
  };
}

export function registerPhase11ManualAppendRoute(app: Express, database: DatabaseManager) {
  app.post("/api/phase11/master-data/inspect", async (request: Request, response: Response, next) => {
    try { response.json(await inspectWorkbook(request.body)); } catch (error) { next(error); }
  });

  app.post("/api/phase11/proposals/suggestions", (request: Request, response: Response, next) => {
    try {
      const suggestions = suggestPhase11Proposals(database, request.body).map((suggestion) => {
        if (!suggestion.center_id) return suggestion;
        const center = database.connection.prepare("SELECT responsible_id FROM activity_centers WHERE id=? AND company_id=?")
          .get(suggestion.center_id, suggestion.company_id) as { responsible_id: number } | undefined;
        return center ? { ...suggestion, responsible_id: center.responsible_id } : suggestion;
      });
      response.json(suggestions);
    } catch (error) { next(error); }
  });

  app.post("/api/phase11/master-data/import", (request: Request, response: Response, next) => {
    const input = request.body as Partial<MasterDataImportInput>;
    const isManualAppend = !input.source_file && input.replace_existing !== true && Array.isArray(input.rows) && input.rows.length === 1;
    if (!isManualAppend || !input.company_id || !input.exercise_id || !input.period_id || !input.version_id || !input.budget_type_id || !input.data_kind) { next(); return; }
    const dataset = database.connection.prepare(`SELECT id FROM master_data_sets
      WHERE company_id=? AND exercise_id=? AND period_id=? AND version_id=? AND budget_type_id=? AND data_kind=?`)
      .get(input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id, input.data_kind) as { id: number } | undefined;
    if (!dataset) { next(); return; }
    const current = database.connection.prepare(`SELECT center_code,center_name,element_code,element_name,account_code,account_name,
      account_nature,line_code,line_name,statement_section,financial_item,cost_behavior,cost_traceability,quantity,unit_price,amount,
      source_reference,notes FROM master_data_rows WHERE dataset_id=? ORDER BY row_order,id`).all(dataset.id) as MasterDataRowInput[];
    const result = importMasterData(database, { ...(input as MasterDataImportInput), replace_existing: true, rows: [...current, ...(input.rows as MasterDataRowInput[])] });
    response.status(201).json({ ...result, message: "Partida agregada al registro maestro existente." });
  });
}
