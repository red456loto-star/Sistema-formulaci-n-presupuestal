import ExcelJS from "exceljs";
import type { ReportColumn, ReportDocument, ReportValueType } from "./report-model";

const PDFDocument = require("pdfkit") as new (options?: Record<string, unknown>) => any;

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
  detail.autoFilter = { from: "A1", to: `${detail.getColumn(Math.max(1, report.columns.length)).letter}1` };
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

function drawPageHeader(doc: any, report: ReportDocument, continuation = false) {
  doc.font("Helvetica-Bold").fontSize(15).text(report.title, { align: "center" });
  doc.moveDown(0.2).font("Helvetica").fontSize(8).text(report.subtitle, { align: "center" });
  doc.moveDown(0.6);
  const left = `${report.context.company_name} · ${report.context.exercise_code} · ${report.context.version_code}`;
  const right = `${report.context.period_label} · ${report.context.currency_code}`;
  doc.fontSize(7).text(left, 36, doc.y, { width: 380 }).text(right, 430, doc.y - 8, { width: 370, align: "right" });
  doc.moveDown(0.8);
  if (continuation) doc.font("Helvetica-Oblique").fontSize(7).text("Continuación", { align: "right" }).font("Helvetica");
}

function ensureSpace(doc: any, report: ReportDocument, required: number) {
  if (doc.y + required <= doc.page.height - 42) return;
  doc.addPage();
  drawPageHeader(doc, report, true);
}

function drawSummary(doc: any, report: ReportDocument) {
  if (!report.summary.length) return;
  doc.font("Helvetica-Bold").fontSize(9).text("Resumen");
  doc.moveDown(0.25);
  const width = (doc.page.width - 72) / Math.min(4, report.summary.length || 1);
  report.summary.forEach((item, index) => {
    if (index > 0 && index % 4 === 0) doc.moveDown(2.5);
    const x = 36 + (index % 4) * width;
    const y = doc.y;
    doc.rect(x, y, width - 8, 34).strokeColor("#cbd5e1").stroke();
    doc.font("Helvetica").fontSize(6.5).fillColor("#475569").text(item.label, x + 5, y + 5, { width: width - 18 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text(formatValue(item.value, item.type, report.context.currency_code), x + 5, y + 17, { width: width - 18 });
  });
  doc.y += 42;
}

function drawTableChunk(doc: any, report: ReportDocument, columns: ReportColumn[], chunkIndex: number, chunks: number) {
  ensureSpace(doc, report, 50);
  if (chunks > 1) doc.font("Helvetica-Bold").fontSize(8).text(`Detalle · bloque ${chunkIndex + 1} de ${chunks}`);
  const pageWidth = doc.page.width - 72;
  const cellWidth = pageWidth / Math.max(1, columns.length);
  const headerHeight = 28;
  const drawHeader = () => {
    const y = doc.y;
    columns.forEach((column, index) => {
      const x = 36 + index * cellWidth;
      doc.rect(x, y, cellWidth, headerHeight).fillAndStroke("#e2e8f0", "#94a3b8");
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(6).text(column.label, x + 3, y + 5, { width: cellWidth - 6, height: headerHeight - 8, ellipsis: true });
    });
    doc.y = y + headerHeight;
  };
  drawHeader();
  for (const row of report.rows) {
    const values = columns.map((column) => formatValue(row[column.key], column.type, report.context.currency_code));
    const rowHeight = Math.max(18, ...values.map((value) => Math.min(44, doc.heightOfString(value, { width: cellWidth - 6 })) + 7));
    if (doc.y + rowHeight > doc.page.height - 42) {
      doc.addPage();
      drawPageHeader(doc, report, true);
      drawHeader();
    }
    const y = doc.y;
    values.forEach((value, index) => {
      const x = 36 + index * cellWidth;
      doc.rect(x, y, cellWidth, rowHeight).strokeColor("#cbd5e1").stroke();
      doc.fillColor("#1e293b").font("Helvetica").fontSize(6).text(value, x + 3, y + 4, { width: cellWidth - 6, height: rowHeight - 7, ellipsis: true });
    });
    doc.y = y + rowHeight;
  }
  if (!report.rows.length) {
    doc.font("Helvetica-Oblique").fontSize(8).text("No existen registros para los filtros seleccionados.", 36, doc.y + 8);
    doc.moveDown(2);
  }
  doc.moveDown(0.8);
}

export async function buildReportPdf(report: ReportDocument): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, info: { Title: report.title, Author: "PresuControl Empresarial", Subject: report.subtitle } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  drawPageHeader(doc, report);
  drawSummary(doc, report);
  const columnChunks: ReportColumn[][] = [];
  for (let index = 0; index < report.columns.length; index += 7) columnChunks.push(report.columns.slice(index, index + 7));
  columnChunks.forEach((columns, index) => {
    if (index > 0) {
      doc.addPage();
      drawPageHeader(doc, report, true);
    }
    drawTableChunk(doc, report, columns, index, columnChunks.length);
  });
  if (report.notes.length) {
    ensureSpace(doc, report, 45);
    doc.font("Helvetica-Bold").fontSize(8).text("Notas y advertencias");
    doc.font("Helvetica").fontSize(7);
    report.notes.forEach((note) => doc.text(`• ${note}`, { indent: 8 }));
  }
  const pages = doc.bufferedPageRange?.();
  if (pages) {
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index);
      doc.font("Helvetica").fontSize(6.5).fillColor("#64748b")
        .text(`Generado ${new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(report.generated_at))} · Página ${index + 1} de ${pages.count}`, 36, doc.page.height - 25, { width: doc.page.width - 72, align: "center" });
    }
  }
  doc.end();
  return finished;
}

export function reportFileName(report: ReportDocument, extension: "xlsx" | "pdf") {
  return `${safeName(report.file_slug)}-${report.context.exercise_code}-${report.context.period_number ?? "anual"}.${extension}`;
}
