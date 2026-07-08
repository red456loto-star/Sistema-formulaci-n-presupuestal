import ExcelJS from "exceljs";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { ensurePhase11Context, type Phase11ContextInput } from "./context";

export type DataKind = "PRESUPUESTADO" | "REAL";

export interface MasterDataRowInput {
  center_code?: string | null;
  center_name?: string | null;
  element_code?: string | null;
  element_name?: string | null;
  account_code?: string | null;
  account_name?: string | null;
  account_nature?: string | null;
  line_code?: string | null;
  line_name: string;
  statement_section?: string | null;
  financial_item?: string | null;
  cost_behavior?: string | null;
  cost_traceability?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  amount: number;
  source_reference?: string | null;
  notes?: string | null;
}

export interface MasterDataImportInput extends Phase11ContextInput {
  data_kind: DataKind;
  source_file?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  source_period?: string | null;
  operator_name?: string | null;
  wacc_rate?: number | null;
  notes?: string | null;
  replace_existing?: boolean;
  rows: MasterDataRowInput[];
}

const templateColumns = [
  ["center_code", "Código del centro"],
  ["center_name", "Nombre del centro"],
  ["element_code", "Código del elemento"],
  ["element_name", "Nombre del elemento"],
  ["account_code", "Código de cuenta"],
  ["account_name", "Nombre de cuenta"],
  ["account_nature", "Naturaleza: INGRESO/COSTO/GASTO/ACTIVO/PASIVO/PATRIMONIO"],
  ["line_code", "Código de línea"],
  ["line_name", "Nombre de línea"],
  ["statement_section", "PRESUPUESTO/ESTADO_RESULTADOS/ESTADO_SITUACION/FLUJO_EFECTIVO"],
  ["financial_item", "Partida financiera normalizada"],
  ["cost_behavior", "FIJO/VARIABLE/NO_APLICA"],
  ["cost_traceability", "DIRECTO/INDIRECTO/NO_APLICA"],
  ["quantity", "Cantidad"],
  ["unit_price", "Precio unitario"],
  ["amount", "Importe"],
  ["source_reference", "Fuente o referencia"],
  ["notes", "Observaciones"],
] as const;

const aliases: Record<string, string[]> = {
  center_code: ["center_code", "centro_codigo", "codigo_centro", "centro"],
  center_name: ["center_name", "centro_nombre", "nombre_centro"],
  element_code: ["element_code", "elemento_codigo", "codigo_elemento", "elemento"],
  element_name: ["element_name", "elemento_nombre", "nombre_elemento"],
  account_code: ["account_code", "cuenta_codigo", "codigo_cuenta", "cuenta"],
  account_name: ["account_name", "cuenta_nombre", "nombre_cuenta"],
  account_nature: ["account_nature", "naturaleza", "naturaleza_cuenta"],
  line_code: ["line_code", "codigo_linea", "codigo"],
  line_name: ["line_name", "nombre_linea", "partida", "descripcion", "concepto"],
  statement_section: ["statement_section", "seccion_estado", "estado_financiero", "seccion"],
  financial_item: ["financial_item", "partida_financiera", "item_financiero", "rubro_financiero"],
  cost_behavior: ["cost_behavior", "comportamiento_costo", "costo_fijo_variable"],
  cost_traceability: ["cost_traceability", "trazabilidad_costo", "costo_directo_indirecto"],
  quantity: ["quantity", "cantidad"],
  unit_price: ["unit_price", "precio_unitario", "costo_unitario"],
  amount: ["amount", "importe", "monto", "valor", "total"],
  source_reference: ["source_reference", "fuente", "referencia"],
  notes: ["notes", "observaciones", "nota"],
};

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizedEnum(value: unknown, allowed: string[]) {
  const candidate = normalize(value).toUpperCase();
  return allowed.includes(candidate) ? candidate : null;
}

function valueFromCell(cell: ExcelJS.Cell) {
  const value = cell.value as unknown;
  if (value && typeof value === "object") {
    if ("result" in (value as Record<string, unknown>)) return (value as Record<string, unknown>).result;
    if ("text" in (value as Record<string, unknown>)) return (value as Record<string, unknown>).text;
    if ("richText" in (value as Record<string, unknown>)) return ((value as { richText: Array<{ text: string }> }).richText ?? []).map((item) => item.text).join("");
  }
  return value;
}

function mappedHeaders(headers: string[]) {
  const normalizedHeaders = headers.map(normalize);
  const mapping: Record<string, number> = {};
  for (const key of Object.keys(aliases)) {
    const index = normalizedHeaders.findIndex((header) => aliases[key].includes(header));
    if (index >= 0) mapping[key] = index + 1;
  }
  return mapping;
}

function parseSheet(sheet: ExcelJS.Worksheet) {
  let headerRow = 1;
  let mapping: Record<string, number> = {};
  for (let rowNumber = 1; rowNumber <= Math.min(15, sheet.rowCount); rowNumber += 1) {
    const headers = sheet.getRow(rowNumber).values as unknown[];
    const candidate = mappedHeaders(headers.slice(1).map((value) => String(value ?? "")));
    if (candidate.line_name && candidate.amount) { headerRow = rowNumber; mapping = candidate; break; }
  }
  if (!mapping.line_name || !mapping.amount) httpError("La hoja debe contener como mínimo las columnas de nombre de línea e importe.", 400);
  const rows: Array<MasterDataRowInput & { row_number: number; warnings: string[] }> = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const get = (key: string) => mapping[key] ? valueFromCell(row.getCell(mapping[key])) : null;
    const lineName = optionalText(get("line_name"));
    const amount = optionalNumber(get("amount"));
    if (!lineName && amount === null) continue;
    const warnings: string[] = [];
    if (!lineName) warnings.push("Falta el nombre de línea.");
    if (amount === null) warnings.push("El importe no es numérico.");
    const accountNature = normalizedEnum(get("account_nature"), ["INGRESO","COSTO","GASTO","ACTIVO","PASIVO","PATRIMONIO"]);
    const statementSection = normalizedEnum(get("statement_section"), ["PRESUPUESTO","ESTADO_RESULTADOS","ESTADO_SITUACION","FLUJO_EFECTIVO"]);
    const costBehavior = normalizedEnum(get("cost_behavior"), ["FIJO","VARIABLE","NO_APLICA"]);
    const costTraceability = normalizedEnum(get("cost_traceability"), ["DIRECTO","INDIRECTO","NO_APLICA"]);
    rows.push({
      row_number: rowNumber,
      center_code: optionalText(get("center_code")), center_name: optionalText(get("center_name")),
      element_code: optionalText(get("element_code")), element_name: optionalText(get("element_name")),
      account_code: optionalText(get("account_code")), account_name: optionalText(get("account_name")), account_nature,
      line_code: optionalText(get("line_code")), line_name: lineName ?? "",
      statement_section: statementSection, financial_item: optionalText(get("financial_item"))?.toUpperCase().replace(/\s+/g, "_") ?? null,
      cost_behavior: costBehavior, cost_traceability: costTraceability,
      quantity: optionalNumber(get("quantity")), unit_price: optionalNumber(get("unit_price")), amount: amount ?? 0,
      source_reference: optionalText(get("source_reference")), notes: optionalText(get("notes")), warnings,
    });
  }
  return { header_row: headerRow, rows };
}

export async function inspectMasterWorkbook(fileName: string, contentBase64: string, sheetName?: string | null) {
  if (!fileName.toLowerCase().endsWith(".xlsx")) httpError("Solo se admiten archivos Excel con extensión .xlsx.", 400);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(contentBase64, "base64"));
  const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!sheet) httpError("El archivo no contiene una hoja válida.", 400);
  const parsed = parseSheet(sheet);
  return {
    file_name: fileName,
    sheet_name: sheet.name,
    sheets: workbook.worksheets.map((item) => ({ name: item.name, row_count: item.rowCount })),
    ...parsed,
    summary: {
      rows_read: parsed.rows.length,
      rows_valid: parsed.rows.filter((row) => row.warnings.length === 0).length,
      rows_observed: parsed.rows.filter((row) => row.warnings.length > 0).length,
    },
  };
}

export async function masterTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos maestros");
  sheet.columns = templateColumns.map(([key, label]) => ({ key, header: label, width: Math.max(18, Math.min(42, label.length + 2)) }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.addRow({
    center_code: "CEN-01", center_name: "Centro de ejemplo", element_code: "ELE-01", element_name: "Elemento de ejemplo",
    account_code: "7011", account_name: "Ventas", account_nature: "INGRESO", line_code: "VENTAS",
    line_name: "Ventas netas", statement_section: "ESTADO_RESULTADOS", financial_item: "SALES",
    cost_behavior: "NO_APLICA", cost_traceability: "NO_APLICA", amount: 100000, source_reference: "Fuente documentada",
  });
  const guide = workbook.addWorksheet("Guía");
  guide.columns = [{ width: 30 }, { width: 90 }];
  guide.addRows([
    ["Regla", "Cada archivo se registra de forma única por empresa, ejercicio, periodo, versión, tipo de presupuesto y origen PRESUPUESTADO o REAL."],
    ["Importe", "Obligatorio y numérico."],
    ["Partidas financieras", "Use SALES, COST_OF_SALES, OPERATING_EXPENSES, OPERATING_INCOME, PRE_TAX_INCOME, INCOME_TAX, NET_INCOME, CASH, RECEIVABLES, INVENTORY, CURRENT_ASSETS, NONCURRENT_ASSETS, TOTAL_ASSETS, CURRENT_LIABILITIES, NONCURRENT_LIABILITIES, TOTAL_LIABILITIES o EQUITY."],
    ["Costos", "Clasifique como FIJO o VARIABLE y como DIRECTO o INDIRECTO cuando corresponda."],
    ["Edición", "Después de importar, cada fila puede modificarse o eliminarse desde Tablas maestras."],
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  return { file_name: "plantilla-datos-maestros.xlsx", content_base64: Buffer.from(buffer).toString("base64") };
}

function resolveDimension(database: DatabaseManager, table: string, companyId: number, code?: string | null) {
  if (!code) return null;
  return database.connection.prepare(`SELECT id,name FROM ${table} WHERE company_id=? AND UPPER(code)=UPPER(?) AND active=1`).get(companyId, code) as { id: number; name: string } | undefined ?? null;
}

function ensureDataset(database: DatabaseManager, input: MasterDataImportInput) {
  const existing = database.connection.prepare(`SELECT * FROM master_data_sets WHERE company_id=? AND exercise_id=? AND period_id=? AND version_id=? AND budget_type_id=? AND data_kind=?`)
    .get(input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id, input.data_kind) as Record<string, unknown> | undefined;
  const stamp = new Date().toISOString();
  if (existing && !input.replace_existing) {
    httpError(`Ya existe información ${input.data_kind.toLowerCase()} para esta combinación. Elimine el registro o active la sustitución.`, 409);
  }
  if (existing) {
    database.connection.prepare("DELETE FROM master_data_rows WHERE dataset_id=?").run(existing.id);
    database.connection.prepare(`UPDATE master_data_sets SET source_file=?,source_label=?,source_url=?,source_period=?,operator_name=?,wacc_rate=?,notes=?,updated_at=? WHERE id=?`)
      .run(input.source_file ?? null, input.source_label ?? null, input.source_url ?? null, input.source_period ?? null, input.operator_name ?? null, input.wacc_rate ?? null, input.notes ?? null, stamp, existing.id);
    return Number(existing.id);
  }
  return Number(database.connection.prepare(`INSERT INTO master_data_sets
    (company_id,exercise_id,period_id,version_id,budget_type_id,data_kind,source_file,source_label,source_url,source_period,operator_name,wacc_rate,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id, input.data_kind,
      input.source_file ?? null, input.source_label ?? null, input.source_url ?? null, input.source_period ?? null,
      input.operator_name ?? null, input.wacc_rate ?? null, input.notes ?? null, stamp, stamp,
    ).lastInsertRowid);
}

export function importMasterData(database: DatabaseManager, input: MasterDataImportInput) {
  ensurePhase11Context(database, input);
  if (!input.rows.length) httpError("No existen filas para registrar.", 400);
  if (input.rows.some((row) => !row.line_name.trim() || !Number.isFinite(Number(row.amount)))) {
    httpError("Todas las filas deben tener nombre de línea e importe numérico.", 400);
  }
  return database.connection.transaction(() => {
    const datasetId = ensureDataset(database, input);
    const insert = database.connection.prepare(`INSERT INTO master_data_rows
      (dataset_id,company_id,exercise_id,period_id,version_id,budget_type_id,data_kind,row_order,
       center_id,center_code,center_name,element_id,element_code,element_name,account_id,account_code,account_name,account_nature,
       line_code,line_name,statement_section,financial_item,cost_behavior,cost_traceability,quantity,unit_price,amount,source_reference,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const stamp = new Date().toISOString();
    let created = 0;
    input.rows.forEach((row, index) => {
      const center = resolveDimension(database, "activity_centers", input.company_id, row.center_code);
      const element = resolveDimension(database, "budget_elements", input.company_id, row.element_code);
      const account = resolveDimension(database, "budget_accounts", input.company_id, row.account_code);
      insert.run(
        datasetId, input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id, input.data_kind, index + 1,
        center?.id ?? null, row.center_code ?? null, row.center_name ?? center?.name ?? null,
        element?.id ?? null, row.element_code ?? null, row.element_name ?? element?.name ?? null,
        account?.id ?? null, row.account_code ?? null, row.account_name ?? account?.name ?? null, row.account_nature ?? null,
        row.line_code ?? null, row.line_name.trim(), row.statement_section ?? "PRESUPUESTO", row.financial_item ?? null,
        row.cost_behavior ?? "NO_APLICA", row.cost_traceability ?? "NO_APLICA", row.quantity ?? null, row.unit_price ?? null,
        Number(row.amount), row.source_reference ?? null, row.notes ?? null, stamp, stamp,
      );
      created += 1;
    });
    return { dataset_id: datasetId, created, message: `Se registraron ${created} filas ${input.data_kind.toLowerCase()} para el contexto activo.` };
  })();
}

export function listMasterData(database: DatabaseManager, input: Phase11ContextInput) {
  ensurePhase11Context(database, input);
  const datasets = database.connection.prepare(`SELECT d.*,bt.code budget_type_code,bt.name budget_type_name,p.period_number,p.name period_name,v.code version_code,v.name version_name,
      COUNT(r.id) row_count,COALESCE(SUM(r.amount),0) total_amount
    FROM master_data_sets d JOIN budget_types bt ON bt.id=d.budget_type_id JOIN budget_periods p ON p.id=d.period_id
    JOIN budget_versions v ON v.id=d.version_id LEFT JOIN master_data_rows r ON r.dataset_id=d.id
    WHERE d.company_id=? AND d.exercise_id=? AND d.period_id=? AND d.version_id=? AND d.budget_type_id=?
    GROUP BY d.id ORDER BY CASE d.data_kind WHEN 'PRESUPUESTADO' THEN 1 ELSE 2 END`).all(
      input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id,
    );
  const rows = database.connection.prepare(`SELECT r.*,d.source_file,d.source_label,d.wacc_rate,bt.name budget_type_name,
      c.name linked_center_name,e.name linked_element_name,a.name linked_account_name
    FROM master_data_rows r JOIN master_data_sets d ON d.id=r.dataset_id JOIN budget_types bt ON bt.id=r.budget_type_id
    LEFT JOIN activity_centers c ON c.id=r.center_id LEFT JOIN budget_elements e ON e.id=r.element_id LEFT JOIN budget_accounts a ON a.id=r.account_id
    WHERE r.company_id=? AND r.exercise_id=? AND r.period_id=? AND r.version_id=? AND r.budget_type_id=?
    ORDER BY CASE r.data_kind WHEN 'PRESUPUESTADO' THEN 1 ELSE 2 END,r.row_order,r.id`).all(
      input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id,
    );
  return { datasets, rows };
}

export function updateMasterRow(database: DatabaseManager, id: number, patch: Partial<MasterDataRowInput>) {
  const current = database.connection.prepare("SELECT * FROM master_data_rows WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!current) httpError("La fila maestra no existe.", 404);
  const merged = { ...current, ...patch } as Record<string, unknown>;
  if (!String(merged.line_name ?? "").trim()) httpError("El nombre de línea es obligatorio.", 400);
  if (!Number.isFinite(Number(merged.amount))) httpError("El importe debe ser numérico.", 400);
  const center = resolveDimension(database, "activity_centers", Number(current.company_id), optionalText(merged.center_code));
  const element = resolveDimension(database, "budget_elements", Number(current.company_id), optionalText(merged.element_code));
  const account = resolveDimension(database, "budget_accounts", Number(current.company_id), optionalText(merged.account_code));
  database.connection.prepare(`UPDATE master_data_rows SET center_id=?,center_code=?,center_name=?,element_id=?,element_code=?,element_name=?,
    account_id=?,account_code=?,account_name=?,account_nature=?,line_code=?,line_name=?,statement_section=?,financial_item=?,cost_behavior=?,
    cost_traceability=?,quantity=?,unit_price=?,amount=?,source_reference=?,notes=?,updated_at=? WHERE id=?`).run(
      center?.id ?? null, optionalText(merged.center_code), optionalText(merged.center_name) ?? center?.name ?? null,
      element?.id ?? null, optionalText(merged.element_code), optionalText(merged.element_name) ?? element?.name ?? null,
      account?.id ?? null, optionalText(merged.account_code), optionalText(merged.account_name) ?? account?.name ?? null,
      normalizedEnum(merged.account_nature, ["INGRESO","COSTO","GASTO","ACTIVO","PASIVO","PATRIMONIO"]),
      optionalText(merged.line_code), String(merged.line_name).trim(),
      normalizedEnum(merged.statement_section, ["PRESUPUESTO","ESTADO_RESULTADOS","ESTADO_SITUACION","FLUJO_EFECTIVO"]) ?? "PRESUPUESTO",
      optionalText(merged.financial_item)?.toUpperCase().replace(/\s+/g, "_") ?? null,
      normalizedEnum(merged.cost_behavior, ["FIJO","VARIABLE","NO_APLICA"]) ?? "NO_APLICA",
      normalizedEnum(merged.cost_traceability, ["DIRECTO","INDIRECTO","NO_APLICA"]) ?? "NO_APLICA",
      optionalNumber(merged.quantity), optionalNumber(merged.unit_price), Number(merged.amount), optionalText(merged.source_reference), optionalText(merged.notes),
      new Date().toISOString(), id,
    );
  return database.connection.prepare("SELECT * FROM master_data_rows WHERE id=?").get(id);
}

export function deleteMasterRow(database: DatabaseManager, id: number) {
  const row = database.connection.prepare("SELECT dataset_id FROM master_data_rows WHERE id=?").get(id) as { dataset_id: number } | undefined;
  if (!row) httpError("La fila maestra no existe.", 404);
  database.connection.prepare("DELETE FROM master_data_rows WHERE id=?").run(id);
  const remaining = Number((database.connection.prepare("SELECT COUNT(*) total FROM master_data_rows WHERE dataset_id=?").get(row.dataset_id) as { total: number }).total);
  if (remaining === 0) database.connection.prepare("DELETE FROM master_data_sets WHERE id=?").run(row.dataset_id);
  return { message: "Fila eliminada correctamente." };
}

export function deleteMasterDataset(database: DatabaseManager, id: number) {
  const result = database.connection.prepare("DELETE FROM master_data_sets WHERE id=?").run(id);
  if (!result.changes) httpError("El registro maestro no existe.", 404);
  return { message: "Registro maestro y sus filas eliminados correctamente." };
}
