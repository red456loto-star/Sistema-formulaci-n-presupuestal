import { createRequire } from "node:module";
import ExcelJS from "exceljs";

const require = createRequire(import.meta.url);
export const { startServer } = require("../apps/api/dist/server.cjs");
export const headers = { "Content-Type": "application/json" };

export async function json(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json();
  return { response, body };
}

export function post(server, route, payload) {
  return json(`${server.url}${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function workbookBase64(sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(columns);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}
