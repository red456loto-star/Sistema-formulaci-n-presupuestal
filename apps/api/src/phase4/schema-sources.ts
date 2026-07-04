import ExcelJS from "exceljs";
import { DatabaseManager } from "../../../../packages/database/src/index";

export function ensureRealDataSources(database: DatabaseManager) {
  database.connection.exec("CREATE TABLE IF NOT EXISTS real_data_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL, source_url TEXT NOT NULL, source_period TEXT, consulted_at TEXT NOT NULL, verified_fields TEXT NOT NULL, transformations TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL, UNIQUE(company_name, source_url))");
  database.connection.exec("CREATE INDEX IF NOT EXISTS idx_real_sources_company ON real_data_sources(company_name, active)");
}

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
  }
  return String(value).trim();
}

export async function loadExcel(contentBase64: string) {
  const buffer = Buffer.from(contentBase64, "base64");
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw Object.assign(new Error("El archivo debe pesar entre 1 byte y 20 MB."), { statusCode: 400 });
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as any); }
  catch { throw Object.assign(new Error("El archivo está corrupto o no es un .xlsx válido."), { statusCode: 400 }); }
  if (workbook.worksheets.length === 0) throw Object.assign(new Error("El archivo no contiene hojas disponibles."), { statusCode: 400 });
  return workbook;
}

export function detectHeaderRow(sheet: ExcelJS.Worksheet) {
  let bestRow = 1;
  let bestScore = 0;
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Array.from({ length: Math.max(row.cellCount, sheet.columnCount) }, (_, index) => cellText(row.getCell(index + 1).value));
    const filled = values.filter(Boolean);
    const score = filled.length + new Set(filled.map((value) => value.toLocaleLowerCase("es"))).size;
    if (filled.length >= 2 && score > bestScore) { bestRow = rowNumber; bestScore = score; }
  }
  return bestRow;
}

export function sheetHeaders(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  return Array.from({ length: Math.max(row.cellCount, sheet.columnCount) }, (_, index) => cellText(row.getCell(index + 1).value) || `Columna_${index + 1}`);
}

export function inspectExcel(workbook: ExcelJS.Workbook) {
  return workbook.worksheets.map((sheet) => {
    const headerRow = detectHeaderRow(sheet);
    const headers = sheetHeaders(sheet, headerRow);
    const preview: Array<Record<string, string>> = [];
    for (let rowNumber = headerRow + 1; rowNumber <= Math.min(sheet.rowCount, headerRow + 5); rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const values = Object.fromEntries(headers.map((header, index) => [header, cellText(row.getCell(index + 1).value)]));
      if (Object.values(values).some(Boolean)) preview.push(values);
    }
    return { name: sheet.name, header_row: headerRow, headers, preview, row_count: Math.max(0, sheet.rowCount - headerRow) };
  });
}
