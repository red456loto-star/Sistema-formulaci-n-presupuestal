import ExcelJS from "exceljs";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import {
  buildFinancialSnapshot,
  horizontalAnalysis,
  type AnalysisDescriptor,
  type FinancialSnapshot,
} from "./calculations";

export type CorrectedFinancialSnapshot = FinancialSnapshot & {
  context: FinancialSnapshot["context"] & {
    currency_id: number;
    currency_code: string;
  };
};

export interface CorrectedHorizontalResult {
  initial: CorrectedFinancialSnapshot["context"];
  final: CorrectedFinancialSnapshot["context"];
  rows: Array<{
    statement: string;
    key: string;
    label: string;
    initial_value: number | null;
    final_value: number | null;
    monetary_difference: number | null;
    percentage_variation: number | null;
  }>;
  warnings: string[];
}

export function buildCorrectedFinancialSnapshot(
  database: DatabaseManager,
  descriptor: AnalysisDescriptor,
): CorrectedFinancialSnapshot {
  const snapshot = buildFinancialSnapshot(database, descriptor);
  const currency = database.connection.prepare(`SELECT e.currency_id,c.code currency_code
    FROM budget_exercises e
    JOIN currencies c ON c.id=e.currency_id
    WHERE e.id=? AND e.company_id=?`)
    .get(descriptor.exercise_id, descriptor.company_id) as { currency_id: number; currency_code: string } | undefined;

  if (!currency) {
    httpError("No fue posible identificar la moneda del ejercicio analizado.", 400);
  }

  return {
    ...snapshot,
    context: {
      ...snapshot.context,
      currency_id: Number(currency.currency_id),
      currency_code: String(currency.currency_code),
    },
    complete: snapshot.complete && snapshot.eva.eva !== null,
  };
}

export function buildCorrectedHorizontalAnalysis(
  database: DatabaseManager,
  initialDescriptor: AnalysisDescriptor,
  finalDescriptor: AnalysisDescriptor,
): CorrectedHorizontalResult {
  const initial = buildCorrectedFinancialSnapshot(database, initialDescriptor);
  const final = buildCorrectedFinancialSnapshot(database, finalDescriptor);

  if (initial.context.currency_id !== final.context.currency_id) {
    httpError(
      `No se pueden comparar importes en monedas distintas (${initial.context.currency_code} y ${final.context.currency_code}) sin una conversión documentada.`,
      400,
    );
  }

  return horizontalAnalysis(initial, final) as CorrectedHorizontalResult;
}

function addRowsSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Array<{ header: string; key: string; width: number }>,
  rows: Array<Record<string, unknown>>,
) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.columns = columns;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  if (columns.length) {
    sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(columns.length).letter}1` };
  }
  return sheet;
}

export function buildHorizontalWorkbook(result: CorrectedHorizontalResult) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PresuControl Empresarial";
  workbook.created = new Date();
  workbook.properties.subject = "Análisis financiero horizontal";

  addRowsSheet(workbook, "Analisis horizontal", [
    { header: "Estado", key: "statement", width: 26 },
    { header: "Partida", key: "label", width: 36 },
    { header: "Valor inicial", key: "initial_value", width: 18 },
    { header: "Valor final", key: "final_value", width: 18 },
    { header: "Diferencia monetaria", key: "monetary_difference", width: 22 },
    { header: "Variación %", key: "percentage_variation", width: 18 },
  ], result.rows as Array<Record<string, unknown>>);

  addRowsSheet(workbook, "Contextos", [
    { header: "Escenario", key: "scenario", width: 16 },
    { header: "Empresa", key: "company", width: 34 },
    { header: "Ejercicio", key: "exercise", width: 20 },
    { header: "Versión", key: "version", width: 28 },
    { header: "Fuente", key: "source", width: 18 },
    { header: "Periodo", key: "period", width: 28 },
    { header: "Moneda", key: "currency", width: 14 },
  ], [
    {
      scenario: "Inicial",
      company: result.initial.company_name,
      exercise: `${result.initial.exercise_code} · ${result.initial.budget_year}`,
      version: `${result.initial.version_code} · ${result.initial.version_name}`,
      source: result.initial.source_type,
      period: result.initial.period_label,
      currency: result.initial.currency_code,
    },
    {
      scenario: "Final",
      company: result.final.company_name,
      exercise: `${result.final.exercise_code} · ${result.final.budget_year}`,
      version: `${result.final.version_code} · ${result.final.version_name}`,
      source: result.final.source_type,
      period: result.final.period_label,
      currency: result.final.currency_code,
    },
  ]);

  addRowsSheet(workbook, "Advertencias", [
    { header: "Detalle", key: "detail", width: 100 },
  ], result.warnings.length
    ? result.warnings.map((warning) => ({ detail: warning }))
    : [{ detail: "Sin advertencias." }]);

  return workbook;
}
