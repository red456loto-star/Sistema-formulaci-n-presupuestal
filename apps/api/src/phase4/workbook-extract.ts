import ExcelJS from "exceljs";
import { cellText, sheetHeaders } from "./schema-sources";

export interface ExtractedRow {
  row_number: number;
  raw: Record<string, string>;
  values: Record<string, string>;
}

export function extractRows(workbook: ExcelJS.Workbook, sheetName: string, headerRow: number, mapping: Record<string, string>): ExtractedRow[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw Object.assign(new Error("La hoja seleccionada no existe."), { statusCode: 400 });
  const headers = sheetHeaders(sheet, headerRow);
  const positions = new Map(headers.map((header, index) => [header, index + 1]));
  const rows: ExtractedRow[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const raw = Object.fromEntries(headers.map((header, index) => [header, cellText(row.getCell(index + 1).value)]));
    if (!Object.values(raw).some(Boolean)) continue;
    const values = Object.fromEntries(Object.entries(mapping).map(([field, header]) => [field, positions.has(header) ? cellText(row.getCell(positions.get(header)!).value) : ""]));
    rows.push({ row_number: rowNumber, raw, values });
    if (rows.length > 5000) throw Object.assign(new Error("La importación supera el límite de 5,000 filas."), { statusCode: 400 });
  }
  return rows;
}
