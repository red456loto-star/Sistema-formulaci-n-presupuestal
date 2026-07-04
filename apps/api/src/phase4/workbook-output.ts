import ExcelJS from "exceljs";
import { ImportTarget } from "./catalog-specs";

export async function templateBase64(target: ImportTarget) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PresuControl Empresarial";
  const sheet = workbook.addWorksheet(target.label);
  sheet.addRow(target.fields.map((item) => item.label));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  target.fields.forEach((item, index) => { sheet.getColumn(index + 1).width = Math.max(16, item.label.length + 4); });
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.addRows([
    ["Tabla destino", target.label],
    ["Campos obligatorios", target.fields.filter((item) => item.required).map((item) => item.label).join(", ")],
    ["Flexibilidad", "Puede cambiar el orden y agregar columnas adicionales."],
    ["Trazabilidad", "Documente fuente pública, periodo y transformaciones."],
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}
