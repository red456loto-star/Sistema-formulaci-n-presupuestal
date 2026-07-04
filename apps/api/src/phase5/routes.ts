import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit, nullableText, positiveId } from "../phase2/common";
import { ensureResponsible, httpError } from "../phase3/common";
import { ensureEditableLine, getOriginalLine, getOriginalVersion, getPeriods, getProjectionYears, nullableNumber, resolveDimensions, roundValue } from "./common";

const numberField = z.coerce.number().finite();
const nullableNumberField = z.union([z.null(), numberField]).optional();
const createSchema = z.object({
  company_id: positiveId, exercise_id: positiveId, version_id: positiveId,
  center_id: positiveId, account_id: positiveId, currency_id: positiveId,
  unit_id: positiveId.optional().nullable(), responsible_id: positiveId.optional().nullable(),
  comment: nullableText(1000), support: nullableText(1000), source: nullableText(500),
});
const monthSchema = z.object({ period_id: positiveId, budgeted_value: numberField, real_value: nullableNumberField });
const projectionSchema = z.object({ projection_year_id: positiveId, budgeted_value: numberField, real_value: nullableNumberField });
const updateSchema = z.object({
  center_id: positiveId.optional(), account_id: positiveId.optional(), currency_id: positiveId.optional(),
  unit_id: positiveId.optional().nullable(), responsible_id: positiveId.optional().nullable(),
  comment: nullableText(1000), support: nullableText(1000), source: nullableText(500),
  monthly_values: z.array(monthSchema).max(12).optional(),
  projections: z.array(projectionSchema).max(3).optional(),
});
const distributeSchema = z.object({ annual_total: numberField });
const copySchema = z.object({ source_line_id: positiveId, include_real: z.boolean().optional().default(false) });
const ratesSchema = z.object({ rates: z.array(numberField.min(-100).max(1000)).length(3) });
const approveSchema = z.object({
  company_id: positiveId, exercise_id: positiveId, version_id: positiveId,
  responsible_id: positiveId, notes: z.string().trim().min(2).max(500),
});

function detail(database: DatabaseManager, id: number) {
  const line = database.connection.prepare(`SELECT l.*,c.code center_code,c.name center_name,
    g.code group_code,g.name group_name,e.code element_code,e.name element_name,
    a.code account_code,a.name account_name,a.nature account_nature,
    cur.code currency_code,cur.symbol currency_symbol,cur.decimals currency_decimals,
    u.code unit_code,u.name unit_name,r.full_name responsible_name
    FROM budget_original_lines l
    JOIN activity_centers c ON c.id=l.center_id JOIN budget_groups g ON g.id=l.group_id
    JOIN budget_elements e ON e.id=l.element_id JOIN budget_accounts a ON a.id=l.account_id
    JOIN currencies cur ON cur.id=l.currency_id LEFT JOIN units_of_measure u ON u.id=l.unit_id
    LEFT JOIN responsibles r ON r.id=l.responsible_id WHERE l.id=?`).get(id) as Record<string, unknown> | undefined;
  if (!line) httpError("La línea presupuestal no existe.", 404);
  const months = database.connection.prepare(`SELECT mv.*,p.period_number,p.name period_name,p.status period_status,p.start_date,p.end_date
    FROM budget_original_monthly_values mv JOIN budget_periods p ON p.id=mv.period_id
    WHERE mv.line_id=? ORDER BY p.period_number`).all(id) as Array<Record<string, unknown>>;
  const projections = database.connection.prepare(`SELECT bp.*,py.sequence,py.year,py.description
    FROM budget_original_projections bp JOIN projection_years py ON py.id=bp.projection_year_id
    WHERE bp.line_id=? ORDER BY py.sequence`).all(id) as Array<Record<string, unknown>>;
  const decimals = Number(line.currency_decimals ?? 2);
  const budget = months.reduce((sum, row) => sum + Number(row.budgeted_value ?? 0), 0);
  const realRows = months.map((row) => nullableNumber(row.real_value)).filter((value): value is number => value !== null);
  const real = realRows.length ? realRows.reduce((sum, value) => sum + value, 0) : null;
  return {
    ...line, monthly_values: months, projections,
    annual_budgeted: roundValue(budget, decimals),
    annual_real: real === null ? null : roundValue(real, decimals),
    annual_variance: real === null ? null : roundValue(real - budget, decimals),
    complete: months.length === 12 && projections.length === 3,
  };
}

function list(database: DatabaseManager, request: Request) {
  const company = Number(request.query.company_id);
  const exercise = Number(request.query.exercise_id);
  const version = Number(request.query.version_id);
  getOriginalVersion(database, version, company, exercise);
  const where = ["company_id=?", "exercise_id=?", "version_id=?"];
  const params: unknown[] = [company, exercise, version];
  for (const field of ["center_id", "group_id", "element_id", "account_id"] as const) {
    const value = Number(request.query[field]);
    if (Number.isInteger(value) && value > 0) { where.push(`${field}=?`); params.push(value); }
  }
  const rows = database.connection.prepare(`SELECT id FROM budget_original_lines WHERE ${where.join(" AND ")} ORDER BY center_id,group_id,element_id,account_id`).all(...params) as Array<{ id: number }>;
  return rows.map((row) => detail(database, row.id));
}

export function registerOriginalBudgetRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/budget-original/lines", (request, response) => response.json(list(database, request)));
  app.get("/api/budget-original/lines/:id", (request, response) => response.json(detail(database, Number(request.params.id))));
  app.get("/api/budget-original/summary", (request, response) => {
    const lines = list(database, request) as Array<Record<string, unknown>>;
    const budget = lines.reduce((sum, row) => sum + Number(row.annual_budgeted ?? 0), 0);
    const withReal = lines.filter((row) => row.annual_real !== null);
    const real = withReal.length ? withReal.reduce((sum, row) => sum + Number(row.annual_real ?? 0), 0) : null;
    response.json({ line_count: lines.length, total_budgeted: budget, total_real: real,
      variance: real === null ? null : real - budget,
      complete_lines: lines.filter((row) => row.complete).length,
      can_approve: lines.length > 0 && lines.every((row) => row.complete) });
  });

  app.post("/api/budget-original/lines", (request: Request, response: Response) => {
    const input = createSchema.parse(request.body);
    const version = getOriginalVersion(database, input.version_id, input.company_id, input.exercise_id, true);
    if (version.period_id) httpError("El presupuesto original debe utilizar una versión de alcance anual.");
    const dimensions = resolveDimensions(database, input.company_id, input.center_id, input.account_id, input.currency_id, input.unit_id, input.responsible_id);
    const periods = getPeriods(database, input.company_id, input.exercise_id);
    const years = getProjectionYears(database, input.company_id, input.exercise_id);
    const stamp = new Date().toISOString();
    const id = database.connection.transaction(() => {
      const result = database.connection.prepare(`INSERT INTO budget_original_lines
        (company_id,exercise_id,version_id,center_id,group_id,element_id,account_id,currency_id,unit_id,responsible_id,comment,support,source_text,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.company_id, input.exercise_id, input.version_id,
        input.center_id, dimensions.groupId, dimensions.elementId, input.account_id, input.currency_id,
        input.unit_id ?? null, input.responsible_id ?? null, input.comment ?? null, input.support ?? null,
        input.source ?? null, stamp, stamp);
      const lineId = Number(result.lastInsertRowid);
      const month = database.connection.prepare("INSERT INTO budget_original_monthly_values (line_id,period_id,budgeted_value,real_value,created_at,updated_at) VALUES (?,?,0,NULL,?,?)");
      periods.forEach((period) => month.run(lineId, period.id, stamp, stamp));
      const projection = database.connection.prepare("INSERT INTO budget_original_projections (line_id,projection_year_id,budgeted_value,real_value,created_at,updated_at) VALUES (?,?,0,NULL,?,?)");
      years.forEach((year) => projection.run(lineId, year.id, stamp, stamp));
      return lineId;
    })();
    audit(database, "CREAR", "budget_original_lines", id, input.company_id, "Línea de presupuesto original creada.", undefined, input);
    response.status(201).json({ id, message: "Línea presupuestal creada con doce meses y tres años de proyección." });
  });

  app.patch("/api/budget-original/lines/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = updateSchema.parse(request.body);
    const before = ensureEditableLine(database, id);
    const company = Number(before.company_id), exercise = Number(before.exercise_id);
    const center = input.center_id ?? Number(before.center_id);
    const account = input.account_id ?? Number(before.account_id);
    const currency = input.currency_id ?? Number(before.currency_id);
    const unit = input.unit_id === undefined ? nullableNumber(before.unit_id) : input.unit_id;
    const responsible = input.responsible_id === undefined ? nullableNumber(before.responsible_id) : input.responsible_id;
    const dimensions = resolveDimensions(database, company, center, account, currency, unit, responsible);
    const periods = new Map(getPeriods(database, company, exercise).map((row) => [Number(row.id), row]));
    const years = new Set(getProjectionYears(database, company, exercise).map((row) => Number(row.id)));
    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      for (const value of input.monthly_values ?? []) {
        const period = periods.get(value.period_id);
        if (!period) httpError("Uno de los periodos no pertenece al ejercicio activo.");
        const current = database.connection.prepare("SELECT * FROM budget_original_monthly_values WHERE line_id=? AND period_id=?").get(id, value.period_id) as Record<string, unknown> | undefined;
        if (!current) httpError("No existe el registro mensual indicado.", 404);
        const nextReal = value.real_value === undefined ? nullableNumber(current.real_value) : value.real_value;
        const changed = Number(current.budgeted_value) !== value.budgeted_value || nullableNumber(current.real_value) !== nextReal;
        if (changed && period.status === "CERRADO") httpError(`El periodo ${String(period.name)} está cerrado y no puede modificarse.`, 409);
        database.connection.prepare("UPDATE budget_original_monthly_values SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?")
          .run(value.budgeted_value, nextReal, stamp, current.id);
      }
      for (const value of input.projections ?? []) {
        if (!years.has(value.projection_year_id)) httpError("Uno de los años proyectados no pertenece al ejercicio activo.");
        const current = database.connection.prepare("SELECT id,real_value FROM budget_original_projections WHERE line_id=? AND projection_year_id=?").get(id, value.projection_year_id) as Record<string, unknown> | undefined;
        if (!current) httpError("No existe el registro de proyección indicado.", 404);
        database.connection.prepare("UPDATE budget_original_projections SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?")
          .run(value.budgeted_value, value.real_value === undefined ? current.real_value : value.real_value, stamp, current.id);
      }
      database.connection.prepare(`UPDATE budget_original_lines SET center_id=?,group_id=?,element_id=?,account_id=?,currency_id=?,unit_id=?,responsible_id=?,comment=?,support=?,source_text=?,updated_at=? WHERE id=?`)
        .run(center, dimensions.groupId, dimensions.elementId, account, currency, unit, responsible,
          input.comment === undefined ? before.comment : input.comment,
          input.support === undefined ? before.support : input.support,
          input.source === undefined ? before.source_text : input.source, stamp, id);
    })();
    audit(database, "EDITAR", "budget_original_lines", id, company, "Línea de presupuesto original actualizada.", before, input);
    response.json({ message: "Línea presupuestal actualizada correctamente." });
  });

  app.post("/api/budget-original/lines/:id/distribute", (request: Request, response: Response) => {
    const id = Number(request.params.id), input = distributeSchema.parse(request.body);
    const line = ensureEditableLine(database, id);
    const decimals = (database.connection.prepare("SELECT decimals FROM currencies WHERE id=?").get(line.currency_id) as { decimals: number }).decimals;
    const rows = database.connection.prepare(`SELECT mv.*,p.status,p.period_number FROM budget_original_monthly_values mv JOIN budget_periods p ON p.id=mv.period_id WHERE mv.line_id=? ORDER BY p.period_number`).all(id) as Array<Record<string, unknown>>;
    const closed = rows.filter((row) => row.status === "CERRADO").reduce((sum, row) => sum + Number(row.budgeted_value), 0);
    const open = rows.filter((row) => row.status === "ABIERTO");
    if (!open.length) httpError("No existen periodos abiertos para distribuir el total anual.", 409);
    const remaining = input.annual_total - closed, share = roundValue(remaining / open.length, decimals), stamp = new Date().toISOString();
    let assigned = 0;
    database.connection.transaction(() => open.forEach((row, index) => {
      const amount = index === open.length - 1 ? roundValue(remaining - assigned, decimals) : share;
      assigned += amount;
      database.connection.prepare("UPDATE budget_original_monthly_values SET budgeted_value=?,updated_at=? WHERE id=?").run(amount, stamp, row.id);
    }))();
    audit(database, "DISTRIBUIR", "budget_original_lines", id, Number(line.company_id), `Total anual ${input.annual_total} distribuido.`, undefined, input);
    response.json({ message: "Total anual distribuido entre los periodos abiertos." });
  });

  app.post("/api/budget-original/lines/:id/project", (request: Request, response: Response) => {
    const id = Number(request.params.id), input = ratesSchema.parse(request.body);
    const line = ensureEditableLine(database, id);
    const decimals = (database.connection.prepare("SELECT decimals FROM currencies WHERE id=?").get(line.currency_id) as { decimals: number }).decimals;
    let value = Number((database.connection.prepare("SELECT COALESCE(SUM(budgeted_value),0) total FROM budget_original_monthly_values WHERE line_id=?").get(id) as { total: number }).total);
    const rows = database.connection.prepare(`SELECT bp.id,py.sequence FROM budget_original_projections bp JOIN projection_years py ON py.id=bp.projection_year_id WHERE bp.line_id=? ORDER BY py.sequence`).all(id) as Array<{ id: number; sequence: number }>;
    if (rows.length !== 3) httpError("La línea no contiene los tres años de proyección.", 409);
    const stamp = new Date().toISOString();
    database.connection.transaction(() => rows.forEach((row, index) => {
      value = roundValue(value * (1 + (input.rates[index] ?? 0) / 100), decimals);
      database.connection.prepare("UPDATE budget_original_projections SET budgeted_value=?,updated_at=? WHERE id=?").run(value, stamp, row.id);
    }))();
    response.json({ message: "Proyección anual calculada para los tres años posteriores." });
  });

  app.post("/api/budget-original/lines/:id/copy", (request: Request, response: Response) => {
    const targetId = Number(request.params.id), input = copySchema.parse(request.body);
    if (targetId === input.source_line_id) httpError("Seleccione una línea de origen diferente.");
    const target = ensureEditableLine(database, targetId), source = getOriginalLine(database, input.source_line_id);
    if (source.company_id !== target.company_id || source.exercise_id !== target.exercise_id || source.version_id !== target.version_id)
      httpError("La línea de origen debe pertenecer a la misma empresa, ejercicio y versión.");
    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      const months = database.connection.prepare(`SELECT s.budgeted_value,s.real_value,t.id target_id,p.status FROM budget_original_monthly_values s JOIN budget_original_monthly_values t ON t.period_id=s.period_id AND t.line_id=? JOIN budget_periods p ON p.id=s.period_id WHERE s.line_id=?`).all(targetId, input.source_line_id) as Array<Record<string, unknown>>;
      months.filter((row) => row.status !== "CERRADO").forEach((row) => database.connection.prepare("UPDATE budget_original_monthly_values SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?").run(row.budgeted_value, input.include_real ? row.real_value : null, stamp, row.target_id));
      const projections = database.connection.prepare(`SELECT s.budgeted_value,s.real_value,t.id target_id FROM budget_original_projections s JOIN budget_original_projections t ON t.projection_year_id=s.projection_year_id AND t.line_id=? WHERE s.line_id=?`).all(targetId, input.source_line_id) as Array<Record<string, unknown>>;
      projections.forEach((row) => database.connection.prepare("UPDATE budget_original_projections SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?").run(row.budgeted_value, input.include_real ? row.real_value : null, stamp, row.target_id));
    })();
    response.json({ message: "Valores copiados dentro de la versión activa. Los periodos cerrados se conservaron." });
  });

  app.delete("/api/budget-original/lines/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id), line = ensureEditableLine(database, id);
    database.connection.prepare("DELETE FROM budget_original_lines WHERE id=?").run(id);
    audit(database, "ELIMINAR", "budget_original_lines", id, Number(line.company_id), "Línea de presupuesto original eliminada.", line);
    response.json({ message: "Línea presupuestal eliminada correctamente." });
  });

  app.post("/api/budget-original/approve", (request: Request, response: Response) => {
    const input = approveSchema.parse(request.body);
    const version = getOriginalVersion(database, input.version_id, input.company_id, input.exercise_id, true);
    ensureResponsible(database, input.responsible_id, input.company_id, true);
    const totals = database.connection.prepare(`SELECT COUNT(*) lines,SUM(CASE WHEN months=12 AND years=3 THEN 1 ELSE 0 END) complete FROM (SELECT l.id,(SELECT COUNT(*) FROM budget_original_monthly_values m WHERE m.line_id=l.id) months,(SELECT COUNT(*) FROM budget_original_projections p WHERE p.line_id=l.id) years FROM budget_original_lines l WHERE l.version_id=?)`).get(input.version_id) as { lines: number; complete: number | null };
    if (!totals.lines) httpError("Registre al menos una línea presupuestal antes de aprobar.", 409);
    if (Number(totals.complete) !== totals.lines) httpError("Todas las líneas deben contener doce meses y tres años de proyección.", 409);
    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      database.connection.prepare("UPDATE budget_versions SET status='APROBADO',responsible_id=?,approved_at=?,updated_at=? WHERE id=?").run(input.responsible_id, stamp, stamp, input.version_id);
      database.connection.prepare("INSERT INTO version_status_history (company_id,version_id,from_status,to_status,responsible_id,notes,created_at) VALUES (?,?,'BORRADOR','APROBADO',?,?,?)").run(input.company_id, input.version_id, input.responsible_id, input.notes, stamp);
    })();
    audit(database, "APROBAR", "budget_versions", input.version_id, input.company_id, `Presupuesto original ${String(version.code)} aprobado.`, version, { ...version, status: "APROBADO" });
    response.json({ message: "Presupuesto original aprobado y bloqueado para edición." });
  });
}
