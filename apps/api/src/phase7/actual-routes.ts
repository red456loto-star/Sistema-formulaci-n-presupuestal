import type { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit } from "../phase2/common";
import { cellText, detectHeaderRow, loadExcel, sheetHeaders } from "../phase4/schema-sources";
import { httpError } from "../phase3/common";
import {
  ensureDimensions,
  ensureEditablePeriod,
  ensurePeriod,
  ensureResponsible,
  getPhase7Context,
  numericId,
  optionalText,
  roundAmount,
} from "./common";

const positiveId = z.coerce.number().int().positive();
const finiteNumber = z.coerce.number().finite();
const budgetType = z.enum(["PRESUPUESTO_ORIGINAL","VENTAS","INVENTARIOS","COMPRAS","PRODUCCION","COSTOS","GASTOS","INVERSIONES","RESULTADOS","SITUACION_FINANCIERA"]);
const sourceType = z.enum(["REAL_PUBLICADO","REAL_INTERNO","DERIVADO","DEMOSTRATIVO"]);

const actualRowFields = {
  period_id: positiveId,
  center_id: positiveId,
  account_id: positiveId,
  budget_type: budgetType,
  budgeted_value: finiteNumber.optional(),
  actual_value: finiteNumber,
  source_type: sourceType,
  source_reference: z.string().trim().min(2).max(1000),
  source_period: z.string().trim().max(100).optional().nullable(),
  source_date: z.string().trim().max(20).optional().nullable(),
  responsible_id: positiveId.optional().nullable(),
  comment: z.string().trim().max(1000).optional().nullable(),
  registered_at: z.string().trim().max(40).optional(),
};

const actualSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  original_version_id: positiveId,
  ...actualRowFields,
});
const importActualRowSchema = z.object(actualRowFields);

const importInspectSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  original_version_id: positiveId,
  file_name: z.string().trim().min(1).max(255),
  content_base64: z.string().min(4),
  sheet_name: z.string().trim().max(120).optional(),
});

const importConfirmSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  original_version_id: positiveId,
  file_name: z.string().trim().min(1).max(255),
  sheet_name: z.string().trim().min(1).max(120),
  operator_text: z.string().trim().max(160).optional().nullable(),
  rows: z.array(importActualRowSchema).min(1).max(5000),
});

type ActualInput = z.infer<typeof actualSchema>;
type ImportPreviewRow = Record<string, unknown> & { row_number: number; status: "VALIDO" | "RECHAZADO"; errors: string[] };

function deriveOriginalBudget(database: DatabaseManager, input: ActualInput) {
  if (input.budgeted_value !== undefined) return input.budgeted_value;
  if (input.budget_type !== "PRESUPUESTO_ORIGINAL") {
    httpError("Ingrese el valor presupuestado para este tipo de presupuesto.", 400);
  }
  const row = database.connection.prepare(`SELECT mv.budgeted_value
    FROM budget_original_lines l
    JOIN budget_original_monthly_values mv ON mv.line_id=l.id
    WHERE l.version_id=? AND l.center_id=? AND l.account_id=? AND mv.period_id=?`)
    .get(input.original_version_id, input.center_id, input.account_id, input.period_id) as { budgeted_value: number } | undefined;
  if (!row) httpError("No existe una línea del presupuesto original para el periodo, centro y cuenta indicados.", 400);
  return Number(row.budgeted_value);
}

function validateActual(database: DatabaseManager, input: ActualInput, editablePeriod = true) {
  const context = getPhase7Context(database, input.company_id, input.exercise_id, input.original_version_id);
  if (editablePeriod) ensureEditablePeriod(database, context, input.period_id);
  else ensurePeriod(database, context, input.period_id);
  ensureDimensions(database, input.company_id, input.center_id, input.account_id);
  ensureResponsible(database, input.company_id, input.responsible_id);
  return { context, budgetedValue: deriveOriginalBudget(database, input) };
}

function listActuals(database: DatabaseManager, companyId: number, exerciseId: number, originalVersionId: number) {
  getPhase7Context(database, companyId, exerciseId, originalVersionId);
  const rows = database.connection.prepare(`SELECT av.*,
    p.period_number,p.name period_name,p.status period_status,
    c.code center_code,c.name center_name,
    a.code account_code,a.name account_name,a.nature account_nature,
    e.id element_id,e.code element_code,e.name element_name,
    g.id group_id,g.code group_code,g.name group_name,
    r.full_name responsible_name
    FROM actual_values av
    JOIN budget_periods p ON p.id=av.period_id
    JOIN activity_centers c ON c.id=av.center_id
    JOIN budget_accounts a ON a.id=av.account_id
    JOIN budget_elements e ON e.id=a.element_id
    JOIN budget_groups g ON g.id=e.group_id
    LEFT JOIN responsibles r ON r.id=av.responsible_id
    WHERE av.company_id=? AND av.exercise_id=? AND av.original_version_id=?
    ORDER BY p.period_number,c.code,a.code,av.budget_type`).all(companyId, exerciseId, originalVersionId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    ...row,
    variance: roundAmount(Number(row.actual_value) - Number(row.budgeted_value)),
  }));
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const aliases: Record<string, string[]> = {
  period_code: ["periodo","periodo_numero","mes","mes_numero","period_number"],
  center_code: ["centro","centro_codigo","codigo_centro","center_code"],
  account_code: ["cuenta","cuenta_codigo","codigo_cuenta","account_code"],
  budget_type: ["tipo_presupuesto","presupuesto_tipo","budget_type"],
  budgeted_value: ["presupuestado","valor_presupuestado","budgeted_value"],
  actual_value: ["real","valor_real","actual_value"],
  source_type: ["tipo_fuente","source_type"],
  source_reference: ["fuente","referencia_fuente","source_reference"],
  source_period: ["periodo_fuente","source_period"],
  source_date: ["fecha_fuente","source_date"],
  responsible_code: ["responsable","responsable_codigo","responsible_code"],
  comment: ["comentario","observacion","comment"],
};

function findColumn(headers: string[], key: string) {
  const normalized = headers.map(normalizeHeader);
  const wanted = aliases[key] ?? [key];
  const index = normalized.findIndex((header) => wanted.includes(header));
  return index >= 0 ? index + 1 : null;
}

function mapImportRows(
  database: DatabaseManager,
  context: ReturnType<typeof getPhase7Context>,
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  headers: string[],
): ImportPreviewRow[] {
  const columns = Object.fromEntries(Object.keys(aliases).map((key) => [key, findColumn(headers, key)])) as Record<string, number | null>;
  for (const required of ["period_code","center_code","account_code","budget_type","actual_value","source_type","source_reference"]) {
    if (!columns[required]) httpError(`Falta la columna requerida: ${required}.`, 400);
  }
  const result: ImportPreviewRow[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const read = (key: string) => columns[key] ? cellText(row.getCell(columns[key] as number).value) : "";
    if (!Object.keys(columns).some((key) => read(key))) continue;
    const errors: string[] = [];
    const periodText = read("period_code");
    const periodNumber = Number(periodText);
    const period = Number.isInteger(periodNumber)
      ? database.connection.prepare("SELECT id,period_number,name FROM budget_periods WHERE company_id=? AND exercise_id=? AND period_number=?")
        .get(context.companyId, context.exerciseId, periodNumber) as Record<string, unknown> | undefined
      : database.connection.prepare("SELECT id,period_number,name FROM budget_periods WHERE company_id=? AND exercise_id=? AND lower(name)=lower(?)")
        .get(context.companyId, context.exerciseId, periodText) as Record<string, unknown> | undefined;
    const center = database.connection.prepare("SELECT id,code,name FROM activity_centers WHERE company_id=? AND upper(code)=upper(?) AND active=1")
      .get(context.companyId, read("center_code")) as Record<string, unknown> | undefined;
    const account = database.connection.prepare("SELECT id,code,name FROM budget_accounts WHERE company_id=? AND upper(code)=upper(?) AND active=1")
      .get(context.companyId, read("account_code")) as Record<string, unknown> | undefined;
    const responsibleText = read("responsible_code");
    const responsible = responsibleText
      ? database.connection.prepare("SELECT id,code,full_name FROM responsibles WHERE company_id=? AND (upper(code)=upper(?) OR lower(full_name)=lower(?)) AND active=1")
        .get(context.companyId, responsibleText, responsibleText) as Record<string, unknown> | undefined
      : undefined;
    const actual = Number(read("actual_value"));
    const budgetedText = read("budgeted_value");
    const budgeted = budgetedText === "" ? undefined : Number(budgetedText);
    const parsedBudgetType = budgetType.safeParse(read("budget_type").toUpperCase());
    const parsedSourceType = sourceType.safeParse(read("source_type").toUpperCase());
    if (!period) errors.push("Periodo no encontrado.");
    if (!center) errors.push("Centro no encontrado.");
    if (!account) errors.push("Cuenta no encontrada.");
    if (!Number.isFinite(actual)) errors.push("El valor real no es numérico.");
    if (budgeted !== undefined && !Number.isFinite(budgeted)) errors.push("El valor presupuestado no es numérico.");
    if (!parsedBudgetType.success) errors.push("Tipo de presupuesto no permitido.");
    if (!parsedSourceType.success) errors.push("Tipo de fuente no permitido.");
    if (!read("source_reference")) errors.push("La fuente es obligatoria.");
    if (responsibleText && !responsible) errors.push("Responsable no encontrado.");
    if (period && center && account) {
      try { ensureDimensions(database, context.companyId, Number(center.id), Number(account.id)); }
      catch { errors.push("La cuenta no está habilitada para el centro."); }
    }
    const duplicate = period && center && account && parsedBudgetType.success
      ? database.connection.prepare(`SELECT id FROM actual_values WHERE original_version_id=? AND period_id=? AND center_id=? AND account_id=? AND budget_type=?`)
        .get(context.originalVersionId, period.id, center.id, account.id, parsedBudgetType.data)
      : undefined;
    if (duplicate) errors.push("Ya existe un dato real para la misma combinación.");

    result.push({
      row_number: rowNumber,
      status: errors.length ? "RECHAZADO" : "VALIDO",
      errors,
      period_id: period?.id ?? null,
      period_label: period ? `${period.period_number} · ${period.name}` : periodText,
      center_id: center?.id ?? null,
      center_label: center ? `${center.code} · ${center.name}` : read("center_code"),
      account_id: account?.id ?? null,
      account_label: account ? `${account.code} · ${account.name}` : read("account_code"),
      budget_type: parsedBudgetType.success ? parsedBudgetType.data : read("budget_type"),
      budgeted_value: budgeted,
      actual_value: Number.isFinite(actual) ? actual : null,
      source_type: parsedSourceType.success ? parsedSourceType.data : read("source_type"),
      source_reference: read("source_reference"),
      source_period: read("source_period") || null,
      source_date: read("source_date") || null,
      responsible_id: responsible?.id ?? null,
      comment: read("comment") || null,
    });
  }
  return result;
}

export function registerActualRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/actuals", (request: Request, response: Response) => {
    response.json(listActuals(
      database,
      numericId(request.query.company_id, "una empresa"),
      numericId(request.query.exercise_id, "un ejercicio"),
      numericId(request.query.original_version_id, "una versión original"),
    ));
  });

  app.post("/api/actuals", (request: Request, response: Response) => {
    const input = actualSchema.parse(request.body);
    const { budgetedValue } = validateActual(database, input);
    const stamp = new Date().toISOString();
    const result = database.connection.prepare(`INSERT INTO actual_values
      (company_id,exercise_id,original_version_id,period_id,center_id,account_id,budget_type,budgeted_value,actual_value,
       source_type,source_reference,source_period,source_date,responsible_id,comment,registered_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      input.company_id,input.exercise_id,input.original_version_id,input.period_id,input.center_id,input.account_id,input.budget_type,
      budgetedValue,input.actual_value,input.source_type,input.source_reference,optionalText(input.source_period),optionalText(input.source_date),
      input.responsible_id ?? null,optionalText(input.comment),input.registered_at ?? stamp,stamp,stamp,
    );
    const id = Number(result.lastInsertRowid);
    audit(database,"CREAR","actual_values",id,input.company_id,"Información real registrada.",undefined,{...input,budgeted_value:budgetedValue});
    response.status(201).json({ id, message: "Información real registrada correctamente." });
  });

  app.patch("/api/actuals/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const before = database.connection.prepare("SELECT * FROM actual_values WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) httpError("El dato real no existe.", 404);
    const input = actualSchema.parse({ ...before, ...(request.body as Record<string, unknown>) });
    if (input.company_id !== Number(before.company_id) || input.exercise_id !== Number(before.exercise_id) || input.original_version_id !== Number(before.original_version_id)) {
      httpError("No se puede trasladar el dato real a otra empresa, ejercicio o versión.", 400);
    }
    const { budgetedValue } = validateActual(database, input);
    database.connection.prepare(`UPDATE actual_values SET period_id=?,center_id=?,account_id=?,budget_type=?,budgeted_value=?,actual_value=?,
      source_type=?,source_reference=?,source_period=?,source_date=?,responsible_id=?,comment=?,registered_at=?,updated_at=? WHERE id=?`).run(
      input.period_id,input.center_id,input.account_id,input.budget_type,budgetedValue,input.actual_value,input.source_type,input.source_reference,
      optionalText(input.source_period),optionalText(input.source_date),input.responsible_id ?? null,optionalText(input.comment),
      input.registered_at ?? before.registered_at,new Date().toISOString(),id,
    );
    audit(database,"EDITAR","actual_values",id,input.company_id,"Información real actualizada.",before,input);
    response.json({ message: "Información real actualizada correctamente." });
  });

  app.delete("/api/actuals/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const before = database.connection.prepare("SELECT * FROM actual_values WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!before) httpError("El dato real no existe.", 404);
    const context = getPhase7Context(database,Number(before.company_id),Number(before.exercise_id),Number(before.original_version_id));
    ensureEditablePeriod(database,context,Number(before.period_id));
    const used = database.connection.prepare("SELECT id FROM forecast_values WHERE original_version_id=? AND period_id=? AND center_id=? AND account_id=? AND value_origin='REAL'")
      .get(before.original_version_id,before.period_id,before.center_id,before.account_id);
    if (used) httpError("El dato real ya fue utilizado por un forecast. Cree una nueva revisión antes de modificarlo.", 409);
    database.connection.prepare("DELETE FROM actual_values WHERE id=?").run(id);
    audit(database,"ELIMINAR","actual_values",id,Number(before.company_id),"Información real eliminada.",before);
    response.json({ message: "Información real eliminada." });
  });

  app.post("/api/actuals/import/inspect", async (request: Request, response: Response, next) => {
    try {
      const input = importInspectSchema.parse(request.body);
      const context = getPhase7Context(database,input.company_id,input.exercise_id,input.original_version_id);
      const workbook = await loadExcel(input.content_base64);
      const sheet = input.sheet_name ? workbook.getWorksheet(input.sheet_name) : workbook.worksheets[0];
      if (!sheet) httpError("La hoja seleccionada no existe.", 400);
      const headerRow = detectHeaderRow(sheet);
      const headers = sheetHeaders(sheet,headerRow);
      const rows = mapImportRows(database,context,sheet,headerRow,headers);
      response.json({
        sheet_name: sheet.name,
        header_row: headerRow,
        headers,
        rows,
        summary: {
          rows_read: rows.length,
          rows_valid: rows.filter((row) => row.status === "VALIDO").length,
          rows_rejected: rows.filter((row) => row.status === "RECHAZADO").length,
        },
      });
    } catch (error) { next(error); }
  });

  app.post("/api/actuals/import/confirm", (request: Request, response: Response) => {
    const input = importConfirmSchema.parse(request.body);
    const context = getPhase7Context(database,input.company_id,input.exercise_id,input.original_version_id);
    const stamp = new Date().toISOString();
    let created = 0;
    database.connection.transaction(() => {
      for (const row of input.rows) {
        const complete = actualSchema.parse({
          ...row,
          company_id: context.companyId,
          exercise_id: context.exerciseId,
          original_version_id: context.originalVersionId,
        });
        const { budgetedValue } = validateActual(database,complete);
        database.connection.prepare(`INSERT INTO actual_values
          (company_id,exercise_id,original_version_id,period_id,center_id,account_id,budget_type,budgeted_value,actual_value,
           source_type,source_reference,source_period,source_date,responsible_id,comment,registered_at,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          complete.company_id,complete.exercise_id,complete.original_version_id,complete.period_id,complete.center_id,complete.account_id,complete.budget_type,
          budgetedValue,complete.actual_value,complete.source_type,complete.source_reference,optionalText(complete.source_period),optionalText(complete.source_date),
          complete.responsible_id ?? null,optionalText(complete.comment),complete.registered_at ?? stamp,stamp,stamp,
        );
        created += 1;
      }
      database.connection.prepare(`INSERT INTO actual_import_batches
        (company_id,exercise_id,original_version_id,file_name,sheet_name,operator_text,rows_read,rows_valid,rows_rejected,rows_created,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        context.companyId,context.exerciseId,context.originalVersionId,input.file_name,input.sheet_name,optionalText(input.operator_text),
        input.rows.length,input.rows.length,0,created,stamp,
      );
    })();
    audit(database,"IMPORTAR","actual_values",null,context.companyId,`${created} filas reales importadas desde ${input.file_name}.`,undefined,{ file_name: input.file_name, sheet_name: input.sheet_name, created });
    response.status(201).json({ created, message: `${created} filas reales importadas correctamente.` });
  });

  app.get("/api/actuals/import/history", (request: Request, response: Response) => {
    const companyId = numericId(request.query.company_id,"una empresa");
    const exerciseId = numericId(request.query.exercise_id,"un ejercicio");
    response.json(database.connection.prepare(`SELECT b.*,v.code original_version_code
      FROM actual_import_batches b JOIN budget_versions v ON v.id=b.original_version_id
      WHERE b.company_id=? AND b.exercise_id=? ORDER BY b.created_at DESC`).all(companyId,exerciseId));
  });

  app.get("/api/actuals/template", async (_request: Request, response: Response, next) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Informacion real");
      sheet.columns = [
        ["Periodo","periodo"],["Centro","centro"],["Cuenta","cuenta"],["Tipo presupuesto","tipo_presupuesto"],
        ["Presupuestado","presupuestado"],["Real","real"],["Tipo fuente","tipo_fuente"],["Fuente","fuente"],
        ["Periodo fuente","periodo_fuente"],["Fecha fuente","fecha_fuente"],["Responsable","responsable"],["Comentario","comentario"],
      ].map(([header,key]) => ({ header, key, width: 22 }));
      sheet.addRow({ periodo: 1, centro: "CENTRO-01", cuenta: "CUENTA-01", tipo_presupuesto: "PRESUPUESTO_ORIGINAL", presupuestado: 1000, real: 950, tipo_fuente: "REAL_INTERNO", fuente: "Cierre contable enero", periodo_fuente: "2027-01", fecha_fuente: "2027-01-31", responsable: "RESP-01", comentario: "Ejemplo demostrativo; reemplazar por datos válidos." });
      sheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      response.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition","attachment; filename=\"plantilla-informacion-real.xlsx\"");
      response.end(Buffer.from(buffer));
    } catch (error) { next(error); }
  });
}
