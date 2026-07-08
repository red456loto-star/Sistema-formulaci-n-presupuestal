import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReportColumn, ReportDocument, ReportValueType } from "./report-model";

function textValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatValue(value: unknown, type: ReportValueType, currencyCode: string) {
  const number = numberValue(value);
  if (type === "money") {
    if (number === null) return "—";
    try { return new Intl.NumberFormat("es-PE", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(number); }
    catch { return `${currencyCode} ${number.toFixed(2)}`; }
  }
  if (type === "percent") return number === null ? "—" : `${number.toFixed(2)} %`;
  if (type === "number") return number === null ? textValue(value) : new Intl.NumberFormat("es-PE", { maximumFractionDigits: 4 }).format(number);
  if (type === "date" && value) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("es-PE").format(date);
  }
  return textValue(value);
}

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function applyExcelFormat(cell: ExcelJS.Cell, type: ReportValueType) {
  if (type === "money") cell.numFmt = '#,##0.00;[Red]-#,##0.00';
  if (type === "percent") cell.numFmt = '0.00" %"';
  if (type === "number") cell.numFmt = '#,##0.####';
  if (type === "date") cell.numFmt = "dd/mm/yyyy";
}

export function buildReportWorkbook(report: ReportDocument) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PresuControl Empresarial";
  workbook.created = new Date();
  workbook.properties.title = report.title;
  workbook.properties.subject = report.subtitle;

  const summary = workbook.addWorksheet("Resumen");
  summary.columns = [{ key: "label", width: 34 }, { key: "value", width: 70 }];
  const metadata: Array<[string, unknown]> = [
    ["Reporte", report.title], ["Descripción", report.subtitle], ["Empresa", report.context.company_name],
    ["Ejercicio", `${report.context.exercise_code} · ${report.context.budget_year}`], ["Versión", `${report.context.version_code} · ${report.context.version_name}`],
    ["Tipo de versión", report.context.version_type], ["Estado", report.context.version_status], ["Periodo", report.context.period_label],
    ["Centro", report.context.center_label], ["Responsable", report.context.responsible_label], ["Moneda", report.context.currency_code],
    ["Generado", report.generated_at],
  ];
  metadata.forEach(([label, value]) => summary.addRow({ label, value }));
  summary.addRow({});
  summary.addRow({ label: "Indicadores", value: "Valor" });
  summary.getRow(summary.rowCount).font = { bold: true };
  report.summary.forEach((item) => {
    const row = summary.addRow({ label: item.label, value: item.value });
    applyExcelFormat(row.getCell(2), item.type);
  });
  summary.addRow({});
  summary.addRow({ label: "Notas y advertencias", value: "Detalle" }).font = { bold: true };
  (report.notes.length ? report.notes : ["Sin advertencias."]).forEach((note) => summary.addRow({ label: "", value: note }));
  summary.getColumn(1).font = { bold: true };
  summary.views = [{ state: "frozen", ySplit: 1 }];
  summary.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  const detail = workbook.addWorksheet("Detalle");
  detail.columns = report.columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.min(48, Math.max(13, column.label.length + 4)),
  }));
  detail.getRow(1).font = { bold: true };
  detail.getRow(1).alignment = { vertical: "middle", wrapText: true };
  detail.views = [{ state: "frozen", ySplit: 1 }];
  if (report.columns.length) detail.autoFilter = { from: "A1", to: `${detail.getColumn(report.columns.length).letter}1` };
  for (const source of report.rows) {
    const row = detail.addRow(source);
    report.columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      const numeric = numberValue(source[column.key]);
      if (["money", "percent", "number"].includes(column.type) && numeric !== null) cell.value = numeric;
      if (column.type === "date" && source[column.key]) {
        const date = new Date(String(source[column.key]));
        if (!Number.isNaN(date.getTime())) cell.value = date;
      }
      applyExcelFormat(cell, column.type);
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }
  detail.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  detail.pageMargins = { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  detail.headerFooter.oddHeader = `&B${report.title}`;
  detail.headerFooter.oddFooter = "Página &P de &N";
  return workbook;
}

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 30;
const HEADER_BOTTOM = 515;
const FOOTER_TOP = 24;

function normalizePdfText(value: string) {
  return value.replace(/[\u2013\u2014]/g, "-").replace(/\u2022/g, "-").replace(/\s+/g, " ").trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 3) {
  const normalized = normalizePdfText(text);
  if (!normalized) return ["—"];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const consumed = lines.join(" ").length;
  if (consumed < normalized.length && lines.length) {
    let last = lines.length - 1;
    while (lines[last].length > 3 && font.widthOfTextAtSize(`${lines[last]}…`, size) > maxWidth) lines[last] = lines[last].slice(0, -1);
    lines[last] = `${lines[last].replace(/[.,;:]$/, "")}…`;
  }
  return lines.slice(0, maxLines);
}

function drawLines(page: PDFPage, lines: string[], x: number, y: number, width: number, font: PDFFont, size: number, color = rgb(0.12, 0.16, 0.23), align: "left" | "center" | "right" = "left") {
  lines.forEach((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, size);
    const adjustedX = align === "center" ? x + Math.max(0, (width - textWidth) / 2) : align === "right" ? x + Math.max(0, width - textWidth) : x;
    page.drawText(line, { x: adjustedX, y: y - index * (size + 2), size, font, color });
  });
}

function drawHeader(page: PDFPage, report: ReportDocument, normal: PDFFont, bold: PDFFont, continuation = false) {
  const [width] = A4_LANDSCAPE;
  drawLines(page, wrapText(report.title, bold, 15, width - 120, 1), 60, 558, width - 120, bold, 15, rgb(0.05, 0.09, 0.16), "center");
  drawLines(page, wrapText(report.subtitle, normal, 8, width - 120, 2), 60, 538, width - 120, normal, 8, rgb(0.29, 0.35, 0.43), "center");
  page.drawLine({ start: { x: MARGIN, y: 526 }, end: { x: width - MARGIN, y: 526 }, thickness: 0.7, color: rgb(0.78, 0.82, 0.87) });
  const left = `${report.context.company_name} · ${report.context.exercise_code} · ${report.context.version_code}`;
  const right = `${report.context.period_label} · ${report.context.currency_code}`;
  drawLines(page, wrapText(left, normal, 7, 390, 1), MARGIN, 516, 390, normal, 7, rgb(0.29, 0.35, 0.43));
  drawLines(page, wrapText(right, normal, 7, 340, 1), width - MARGIN - 340, 516, 340, normal, 7, rgb(0.29, 0.35, 0.43), "right");
  if (continuation) page.drawText("Continuación", { x: width - 110, y: 499, size: 6.5, font: normal, color: rgb(0.4, 0.45, 0.53) });
}

function addPage(pdf: PDFDocument, report: ReportDocument, normal: PDFFont, bold: PDFFont, continuation = false) {
  const page = pdf.addPage(A4_LANDSCAPE);
  drawHeader(page, report, normal, bold, continuation);
  return { page, y: continuation ? 492 : HEADER_BOTTOM - 18 };
}

function drawSummary(page: PDFPage, report: ReportDocument, normal: PDFFont, bold: PDFFont, startY: number) {
  if (!report.summary.length) return startY;
  page.drawText("Resumen", { x: MARGIN, y: startY, size: 9, font: bold, color: rgb(0.05, 0.09, 0.16) });
  let y = startY - 12;
  const columns = Math.min(4, Math.max(1, report.summary.length));
  const gap = 8;
  const cardWidth = (A4_LANDSCAPE[0] - MARGIN * 2 - gap * (columns - 1)) / columns;
  report.summary.forEach((item, index) => {
    if (index > 0 && index % columns === 0) y -= 43;
    const column = index % columns;
    const x = MARGIN + column * (cardWidth + gap);
    page.drawRectangle({ x, y: y - 34, width: cardWidth, height: 34, borderWidth: 0.6, borderColor: rgb(0.78, 0.82, 0.87), color: rgb(0.97, 0.98, 0.99) });
    drawLines(page, wrapText(item.label, normal, 6.5, cardWidth - 10, 1), x + 5, y - 9, cardWidth - 10, normal, 6.5, rgb(0.35, 0.4, 0.48));
    drawLines(page, wrapText(formatValue(item.value, item.type, report.context.currency_code), bold, 8, cardWidth - 10, 1), x + 5, y - 23, cardWidth - 10, bold, 8, rgb(0.05, 0.09, 0.16));
  });
  const rows = Math.ceil(report.summary.length / columns);
  return startY - 18 - rows * 43;
}

function drawTableHeader(page: PDFPage, columns: ReportColumn[], y: number, normal: PDFFont, bold: PDFFont) {
  const width = A4_LANDSCAPE[0] - MARGIN * 2;
  const cellWidth = width / Math.max(1, columns.length);
  const height = 26;
  columns.forEach((column, index) => {
    const x = MARGIN + index * cellWidth;
    page.drawRectangle({ x, y: y - height, width: cellWidth, height, borderWidth: 0.55, borderColor: rgb(0.58, 0.64, 0.71), color: rgb(0.89, 0.92, 0.95) });
    drawLines(page, wrapText(column.label, bold, 6, cellWidth - 6, 2), x + 3, y - 8, cellWidth - 6, bold, 6, rgb(0.05, 0.09, 0.16));
  });
  return { y: y - height, cellWidth };
}

function drawTableRow(page: PDFPage, columns: ReportColumn[], row: Record<string, unknown>, y: number, cellWidth: number, normal: PDFFont, report: ReportDocument) {
  const size = 5.8;
  const values = columns.map((column) => wrapText(formatValue(row[column.key], column.type, report.context.currency_code), normal, size, cellWidth - 6, 3));
  const maxLines = Math.max(1, ...values.map((lines) => lines.length));
  const height = Math.max(17, 7 + maxLines * (size + 2));
  values.forEach((lines, index) => {
    const x = MARGIN + index * cellWidth;
    page.drawRectangle({ x, y: y - height, width: cellWidth, height, borderWidth: 0.35, borderColor: rgb(0.79, 0.83, 0.87) });
    drawLines(page, lines, x + 3, y - 8, cellWidth - 6, normal, size, rgb(0.12, 0.16, 0.23));
  });
  return y - height;
}

export async function buildReportPdf(report: ReportDocument): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(report.title);
  pdf.setSubject(report.subtitle);
  pdf.setAuthor("PresuControl Empresarial");
  pdf.setCreator("PresuControl Empresarial");
  pdf.setCreationDate(new Date(report.generated_at));
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let state = addPage(pdf, report, normal, bold);
  state.y = drawSummary(state.page, report, normal, bold, state.y);
  const columnChunks: ReportColumn[][] = [];
  for (let index = 0; index < report.columns.length; index += 7) columnChunks.push(report.columns.slice(index, index + 7));
  if (!columnChunks.length) columnChunks.push([]);

  columnChunks.forEach((columns, chunkIndex) => {
    if (chunkIndex > 0) state = addPage(pdf, report, normal, bold, true);
    if (columnChunks.length > 1) {
      state.page.drawText(`Detalle · bloque ${chunkIndex + 1} de ${columnChunks.length}`, { x: MARGIN, y: state.y, size: 8, font: bold, color: rgb(0.05, 0.09, 0.16) });
      state.y -= 12;
    }
    if (!columns.length) return;
    let header = drawTableHeader(state.page, columns, state.y, normal, bold);
    state.y = header.y;
    if (!report.rows.length) {
      state.page.drawText("No existen registros para los filtros seleccionados.", { x: MARGIN, y: state.y - 14, size: 8, font: normal, color: rgb(0.35, 0.4, 0.48) });
      state.y -= 25;
      return;
    }
    report.rows.forEach((row) => {
      const testValues = columns.map((column) => wrapText(formatValue(row[column.key], column.type, report.context.currency_code), normal, 5.8, header.cellWidth - 6, 3));
      const rowHeight = Math.max(17, 7 + Math.max(1, ...testValues.map((lines) => lines.length)) * 7.8);
      if (state.y - rowHeight < FOOTER_TOP + 18) {
        state = addPage(pdf, report, normal, bold, true);
        header = drawTableHeader(state.page, columns, state.y, normal, bold);
        state.y = header.y;
      }
      state.y = drawTableRow(state.page, columns, row, state.y, header.cellWidth, normal, report);
    });
  });

  if (report.notes.length) {
    if (state.y < 72) state = addPage(pdf, report, normal, bold, true);
    state.page.drawText("Notas y advertencias", { x: MARGIN, y: state.y - 8, size: 8, font: bold, color: rgb(0.05, 0.09, 0.16) });
    let noteY = state.y - 20;
    report.notes.forEach((note) => {
      const lines = wrapText(`- ${note}`, normal, 7, A4_LANDSCAPE[0] - MARGIN * 2, 3);
      drawLines(state.page, lines, MARGIN, noteY, A4_LANDSCAPE[0] - MARGIN * 2, normal, 7, rgb(0.29, 0.35, 0.43));
      noteY -= lines.length * 9 + 3;
    });
  }

  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const footer = `Generado ${new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(report.generated_at))} · Página ${index + 1} de ${pages.length}`;
    drawLines(page, [footer], MARGIN, 12, A4_LANDSCAPE[0] - MARGIN * 2, normal, 6.5, rgb(0.4, 0.45, 0.53), "center");
  });
  return Buffer.from(await pdf.save());
}

export function reportFileName(report: ReportDocument, extension: "xlsx" | "pdf") {
  return `${safeName(report.file_slug)}-${report.context.exercise_code}-${report.context.period_number ?? "anual"}.${extension}`;
}
