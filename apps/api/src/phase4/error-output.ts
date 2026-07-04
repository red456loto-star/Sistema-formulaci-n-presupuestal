import ExcelJS from "exceljs";

export async function errorReportBase64(rows: Array<Record<string, unknown>>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Errores");
  sheet.addRow(["Fila", "Validación", "Resultado", "Errores", "Observaciones", "Datos normalizados"]);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    const errors = row.errors ? JSON.parse(String(row.errors)) as string[] : [];
    const warnings = row.warnings ? JSON.parse(String(row.warnings)) as string[] : [];
    sheet.addRow([row.row_number, row.validation_status, row.action_result ?? "", errors.join(" | "), warnings.join(" | "), row.normalized_data]);
  }
  sheet.columns.forEach((column, index) => { column.width = index === 5 ? 55 : 24; });
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}
