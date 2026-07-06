import type { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit } from "../phase2/common";
import { httpError } from "../phase3/common";
import {
  buildFinancialSnapshot,
  horizontalAnalysis,
  type AnalysisDescriptor,
  type AnalysisSourceType,
} from "./calculations";

const positiveId = z.coerce.number().int().positive();
const sourceTypeSchema = z.enum(["ORIGINAL", "FORECAST", "REAL"]);
const nullableRate = z.union([z.null(), z.coerce.number().finite().min(0).max(100)]).optional();
const descriptorSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  source_type: sourceTypeSchema,
  period_number: z.union([z.null(), z.coerce.number().int().min(1).max(12)]).optional(),
});

const mappingSchema = z.object({
  account_id: positiveId,
  statement_section: z.enum([
    "SALES", "COST_OF_SALES", "OPERATING_EXPENSE", "INCOME_TAX",
    "CURRENT_ASSET", "NONCURRENT_ASSET", "CURRENT_LIABILITY", "NONCURRENT_LIABILITY", "EQUITY", "IGNORE",
  ]),
  ratio_role: z.enum(["CASH", "RECEIVABLES", "INVENTORY", "OTHER"]).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const mappingBatchSchema = z.object({
  company_id: positiveId,
  mappings: z.array(mappingSchema).max(5000),
});

const assumptionSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  source_type: sourceTypeSchema,
  tax_rate: nullableRate,
  cost_of_capital_rate: nullableRate,
  invested_capital_override: z.union([z.null(), z.coerce.number().finite().min(0)]).optional(),
  source_reference: z.string().trim().min(2).max(1000),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const horizontalSchema = z.object({
  initial: descriptorSchema,
  final: descriptorSchema,
});

function textOrNull(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
}

function descriptorFromQuery(request: Request): AnalysisDescriptor {
  const parsed = descriptorSchema.parse({
    company_id: request.query.company_id,
    exercise_id: request.query.exercise_id,
    version_id: request.query.version_id,
    source_type: request.query.source_type,
    period_number: request.query.period_number === undefined || request.query.period_number === "" ? null : request.query.period_number,
  });
  return parsed as AnalysisDescriptor;
}

function ensureCompany(database: DatabaseManager, companyId: number) {
  const company = database.connection.prepare("SELECT id FROM companies WHERE id=? AND active=1").get(companyId);
  if (!company) httpError("La empresa seleccionada no existe o está inactiva.", 400);
}

function ensureAccount(database: DatabaseManager, companyId: number, accountId: number) {
  const account = database.connection.prepare("SELECT * FROM budget_accounts WHERE id=? AND company_id=? AND active=1")
    .get(accountId, companyId) as Record<string, unknown> | undefined;
  if (!account) httpError("La cuenta no pertenece a la empresa activa o está inactiva.", 400);
  return account;
}

function ensureAnalysisVersion(database: DatabaseManager, companyId: number, exerciseId: number, versionId: number, sourceType: AnalysisSourceType) {
  const exercise = database.connection.prepare("SELECT id FROM budget_exercises WHERE id=? AND company_id=?")
    .get(exerciseId, companyId);
  if (!exercise) httpError("El ejercicio no pertenece a la empresa activa.", 400);
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?")
    .get(versionId, companyId, exerciseId) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece al contexto seleccionado.", 400);
  const expected = sourceType === "FORECAST" ? "FORECAST" : "ORIGINAL";
  if (String(version.version_type) !== expected) {
    httpError(`La fuente ${sourceType} requiere una versión de tipo ${expected}.`, 400);
  }
  return version;
}

function addRowsSheet(workbook: ExcelJS.Workbook, name: string, columns: Array<{ header: string; key: string; width: number }>, rows: Array<Record<string, unknown>>) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.columns = columns;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  if (columns.length) sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(columns.length).letter}1` };
  return sheet;
}

function buildWorkbook(snapshot: ReturnType<typeof buildFinancialSnapshot>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PresuControl Empresarial";
  workbook.created = new Date();
  workbook.properties.subject = "Estados financieros y análisis financiero";

  addRowsSheet(workbook, "Estado de resultados", [
    { header: "Partida", key: "label", width: 32 },
    { header: "Valor", key: "value", width: 18 },
  ], [
    { label: "Ventas", value: snapshot.income_statement.sales },
    { label: "Costos", value: snapshot.income_statement.cost_of_sales },
    { label: "Utilidad bruta", value: snapshot.income_statement.gross_profit },
    { label: "Gastos", value: snapshot.income_statement.operating_expenses },
    { label: "Utilidad operativa", value: snapshot.income_statement.operating_income },
    { label: "Resultado antes de impuestos", value: snapshot.income_statement.pre_tax_income },
    { label: "Impuesto", value: snapshot.income_statement.income_tax },
    { label: "Resultado neto", value: snapshot.income_statement.net_income },
  ]);

  addRowsSheet(workbook, "Situacion financiera", [
    { header: "Partida", key: "label", width: 36 },
    { header: "Valor", key: "value", width: 18 },
  ], [
    { label: "Activos corrientes", value: snapshot.balance_sheet.current_assets },
    { label: "Activos no corrientes", value: snapshot.balance_sheet.noncurrent_assets },
    { label: "Total activos", value: snapshot.balance_sheet.total_assets },
    { label: "Pasivos corrientes", value: snapshot.balance_sheet.current_liabilities },
    { label: "Pasivos no corrientes", value: snapshot.balance_sheet.noncurrent_liabilities },
    { label: "Total pasivos", value: snapshot.balance_sheet.total_liabilities },
    { label: "Patrimonio", value: snapshot.balance_sheet.equity },
    { label: "Total pasivo y patrimonio", value: snapshot.balance_sheet.total_liabilities_and_equity },
    { label: "Diferencia de balance", value: snapshot.balance_sheet.balance_difference },
  ]);

  addRowsSheet(workbook, "Analisis vertical", [
    { header: "Estado", key: "statement", width: 24 },
    { header: "Partida", key: "label", width: 32 },
    { header: "Valor", key: "value", width: 18 },
    { header: "Base", key: "base_label", width: 28 },
    { header: "Valor base", key: "base_value", width: 18 },
    { header: "Participación %", key: "percentage", width: 18 },
  ], snapshot.vertical_analysis as unknown as Array<Record<string, unknown>>);

  addRowsSheet(workbook, "Ratios", [
    { header: "Categoría", key: "category", width: 18 },
    { header: "Nombre", key: "name", width: 30 },
    { header: "Fórmula", key: "formula", width: 45 },
    { header: "Resultado", key: "result", width: 16 },
    { header: "Unidad", key: "unit", width: 12 },
    { header: "Interpretación", key: "interpretation", width: 60 },
    { header: "Variables", key: "variables_text", width: 60 },
    { header: "Fuente", key: "source_text", width: 60 },
  ], snapshot.ratios.map((ratio) => ({
    ...ratio,
    variables_text: Object.entries(ratio.variables).map(([key, value]) => `${key}: ${value ?? "No disponible"}`).join("; "),
    source_text: ratio.sources.join(" | "),
  })));

  addRowsSheet(workbook, "Dupont y EVA", [
    { header: "Análisis", key: "analysis", width: 18 },
    { header: "Variable", key: "variable", width: 30 },
    { header: "Valor", key: "value", width: 18 },
    { header: "Fórmula o interpretación", key: "detail", width: 70 },
  ], [
    { analysis: "Dupont", variable: "Margen neto (%)", value: snapshot.dupont.net_margin, detail: snapshot.dupont.formula },
    { analysis: "Dupont", variable: "Rotación de activos", value: snapshot.dupont.asset_turnover, detail: snapshot.dupont.interpretation },
    { analysis: "Dupont", variable: "Multiplicador financiero", value: snapshot.dupont.financial_multiplier, detail: snapshot.dupont.interpretation },
    { analysis: "Dupont", variable: "ROE resultante (%)", value: snapshot.dupont.roe, detail: snapshot.dupont.interpretation },
    { analysis: "EVA", variable: "NOPAT", value: snapshot.eva.nopat, detail: snapshot.eva.formula },
    { analysis: "EVA", variable: "Capital invertido", value: snapshot.eva.invested_capital, detail: snapshot.eva.formula },
    { analysis: "EVA", variable: "Costo de capital (%)", value: snapshot.eva.cost_of_capital_rate, detail: snapshot.eva.interpretation },
    { analysis: "EVA", variable: "Cargo de capital", value: snapshot.eva.capital_charge, detail: snapshot.eva.interpretation },
    { analysis: "EVA", variable: "EVA", value: snapshot.eva.eva, detail: snapshot.eva.interpretation },
  ]);

  addRowsSheet(workbook, "Fuentes y supuestos", [
    { header: "Tipo", key: "type", width: 20 },
    { header: "Detalle", key: "detail", width: 100 },
  ], [
    ...snapshot.sources.map((source) => ({ type: "Fuente", detail: source })),
    { type: "Supuesto", detail: `Tasa de impuesto: ${snapshot.assumptions.tax_rate ?? "No registrada"}` },
    { type: "Supuesto", detail: `Costo de capital: ${snapshot.assumptions.cost_of_capital_rate ?? "No registrado"}` },
    { type: "Supuesto", detail: `Capital invertido manual: ${snapshot.assumptions.invested_capital_override ?? "No registrado; se deriva de activos menos pasivos corrientes"}` },
    { type: "Referencia", detail: snapshot.assumptions.source_reference ?? "Sin referencia documentada" },
    ...snapshot.warnings.map((warning) => ({ type: "Advertencia", detail: warning })),
  ]);
  return workbook;
}

export function registerFinancialAnalysisRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/financial-analysis/mappings", (request: Request, response: Response) => {
    const companyId = positiveId.parse(request.query.company_id);
    ensureCompany(database, companyId);
    const rows = database.connection.prepare(`SELECT a.id account_id,a.code account_code,a.name account_name,a.nature account_nature,
      e.code element_code,g.code group_code,m.statement_section,m.ratio_role,m.notes
      FROM budget_accounts a
      JOIN budget_elements e ON e.id=a.element_id
      JOIN budget_groups g ON g.id=e.group_id
      LEFT JOIN financial_account_mappings m ON m.company_id=a.company_id AND m.account_id=a.id
      WHERE a.company_id=? AND a.active=1
      ORDER BY g.code,e.code,a.code`).all(companyId);
    response.json(rows);
  });

  app.put("/api/financial-analysis/mappings", (request: Request, response: Response) => {
    const input = mappingBatchSchema.parse(request.body);
    ensureCompany(database, input.company_id);
    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      for (const mapping of input.mappings) {
        const account = ensureAccount(database, input.company_id, mapping.account_id);
        if (mapping.statement_section !== "CURRENT_ASSET" && mapping.ratio_role && mapping.ratio_role !== "OTHER") {
          httpError("Los roles caja, cuentas por cobrar e inventario solo corresponden a activos corrientes.", 400);
        }
        database.connection.prepare(`INSERT INTO financial_account_mappings
          (company_id,account_id,statement_section,ratio_role,notes,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(company_id,account_id) DO UPDATE SET
          statement_section=excluded.statement_section,ratio_role=excluded.ratio_role,notes=excluded.notes,updated_at=excluded.updated_at`)
          .run(input.company_id, mapping.account_id, mapping.statement_section, mapping.ratio_role ?? null, textOrNull(mapping.notes), stamp, stamp);
        audit(database, "CONFIGURAR", "financial_account_mappings", mapping.account_id, input.company_id, `Clasificación financiera actualizada para ${String(account.code)}.`, undefined, mapping);
      }
    })();
    response.json({ updated: input.mappings.length, message: `${input.mappings.length} clasificaciones financieras guardadas.` });
  });

  app.get("/api/financial-analysis/assumptions", (request: Request, response: Response) => {
    const descriptor = descriptorFromQuery(request);
    const snapshot = buildFinancialSnapshot(database, descriptor);
    response.json(snapshot.assumptions);
  });

  app.put("/api/financial-analysis/assumptions", (request: Request, response: Response) => {
    const input = assumptionSchema.parse(request.body);
    ensureCompany(database, input.company_id);
    ensureAnalysisVersion(database, input.company_id, input.exercise_id, input.version_id, input.source_type);
    const stamp = new Date().toISOString();
    const before = database.connection.prepare(`SELECT * FROM financial_analysis_assumptions
      WHERE company_id=? AND exercise_id=? AND version_id=? AND source_type=?`)
      .get(input.company_id, input.exercise_id, input.version_id, input.source_type) as Record<string, unknown> | undefined;
    database.connection.prepare(`INSERT INTO financial_analysis_assumptions
      (company_id,exercise_id,version_id,source_type,tax_rate,cost_of_capital_rate,invested_capital_override,source_reference,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(company_id,exercise_id,version_id,source_type) DO UPDATE SET
      tax_rate=excluded.tax_rate,cost_of_capital_rate=excluded.cost_of_capital_rate,
      invested_capital_override=excluded.invested_capital_override,source_reference=excluded.source_reference,
      notes=excluded.notes,updated_at=excluded.updated_at`)
      .run(input.company_id, input.exercise_id, input.version_id, input.source_type,
        input.tax_rate ?? null, input.cost_of_capital_rate ?? null, input.invested_capital_override ?? null,
        input.source_reference, textOrNull(input.notes), stamp, stamp);
    audit(database, before ? "EDITAR" : "CREAR", "financial_analysis_assumptions", before ? Number(before.id) : null, input.company_id, "Supuestos del análisis financiero guardados.", before, input);
    response.json({ message: "Supuestos financieros guardados correctamente." });
  });

  app.get("/api/financial-analysis/report", (request: Request, response: Response) => {
    response.json(buildFinancialSnapshot(database, descriptorFromQuery(request)));
  });

  app.post("/api/financial-analysis/horizontal", (request: Request, response: Response) => {
    const input = horizontalSchema.parse(request.body);
    const initial = buildFinancialSnapshot(database, input.initial as AnalysisDescriptor);
    const final = buildFinancialSnapshot(database, input.final as AnalysisDescriptor);
    response.json(horizontalAnalysis(initial, final));
  });

  app.get("/api/financial-analysis/export", async (request: Request, response: Response, next) => {
    try {
      const snapshot = buildFinancialSnapshot(database, descriptorFromQuery(request));
      const workbook = buildWorkbook(snapshot);
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `analisis-financiero-${snapshot.context.source_type.toLowerCase()}-${snapshot.context.version_code}.xlsx`;
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      response.end(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  });
}
