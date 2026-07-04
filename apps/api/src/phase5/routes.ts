import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit, nullableText, positiveId } from "../phase2/common";
import { ensureResponsible, httpError } from "../phase3/common";
import {
  ensureEditableLine,
  getOriginalLine,
  getOriginalVersion,
  getPeriods,
  getProjectionYears,
  nullableNumber,
  resolveDimensions,
  roundValue,
} from "./common";

const finiteNumber = z.coerce.number().finite();
const nullableFinite = z.union([z.null(), finiteNumber]).optional();

const createLineSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  center_id: positiveId,
  account_id: positiveId,
  currency_id: positiveId,
  unit_id: positiveId.optional().nullable(),
  responsible_id: positiveId.optional().nullable(),
  comment: nullableText(1000),
  support: nullableText(1000),
  source: nullableText(500),
});

const monthlyValueSchema = z.object({
  period_id: positiveId,
  budgeted_value: finiteNumber,
  real_value: nullableFinite,
});

const projectionValueSchema = z.object({
  projection_year_id: positiveId,
  budgeted_value: finiteNumber,
  real_value: nullableFinite,
});

const updateLineSchema = z.object({
  center_id: positiveId.optional(),
  account_id: positiveId.optional(),
  currency_id: positiveId.optional(),
  unit_id: positiveId.optional().nullable(),
  responsible_id: positiveId.optional().nullable(),
  comment: nullableText(1000),
  support: nullableText(1000),
  source: nullableText(500),
  monthly_values: z.array(monthlyValueSchema).max(12).optional(),
  projections: z.array(projectionValueSchema).max(3).optional(),
});

const distributeSchema = z.object({ annual_total: finiteNumber });
const copySchema = z.object({ source_line_id: positiveId, include_real: z.boolean().optional().default(false) });
const projectSchema = z.object({ rates: z.tuple([
  finiteNumber.min(-100).max(1000),
  finiteNumber.min(-100).max(1000),
  finiteNumber.min(-100).max(1000),
]) });
const approveSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  responsible_id: positiveId,
  notes: z.string().trim().min(2).max(500),
});

function queryId(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function detailedLine(database: DatabaseManager, lineId: number) {
  const line = database.connection.prepare(`SELECT l.*, c.code AS center_code, c.name AS center_name,
    g.code AS group_code, g.name AS group_name, e.code AS element_code, e.name AS element_name,
    a.code AS account_code, a.name AS account_name, a.nature AS account_nature,
    cur.code AS currency_code, cur.symbol AS currency_symbol, cur.decimals AS currency_decimals,
    u.code AS unit_code, u.name AS unit_name, r.full_name AS responsible_name
    FROM budget_original_lines l
    JOIN activity_centers c ON c.id=l.center_id
    JOIN budget_groups g ON g.id=l.group_id
    JOIN budget_elements e ON e.id=l.element_id
    JOIN budget_accounts a ON a.id=l.account_id
    JOIN currencies cur ON cur.id=l.currency_id
    LEFT JOIN units_of_measure u ON u.id=l.unit_id
    LEFT JOIN responsibles r ON r.id=l.responsible_id
    WHERE l.id=?`).get(lineId) as Record<string, unknown> | undefined;
  if (!line) httpError("La línea presupuestal no existe.", 404);

  const monthly = database.connection.prepare(`SELECT mv.*, p.period_number, p.name AS period_name,
    p.status AS period_status, p.start_date, p.end_date
    FROM budget_original_monthly_values mv
    JOIN budget_periods p ON p.id=mv.period_id
    WHERE mv.line_id=? ORDER BY p.period_number`).all(lineId) as Array<Record<string, unknown>>;
  const projections = database.connection.prepare(`SELECT bp.*, py.sequence, py.year, py.description
    FROM budget_original_projections bp
    JOIN projection_years py ON py.id=bp.projection_year_id
    WHERE bp.line_id=? ORDER BY py.sequence`).all(lineId) as Array<Record<string, unknown>>;

  const decimals = Number(line.currency_decimals ?? 2);
  const annualBudgeted = monthly.reduce((sum, item) => sum + Number(item.budgeted_value ?? 0), 0);
  const realValues = monthly
    .map((item) => nullableNumber(item.real_value))
    .filter((value): value is number => value !== null);
  const annualReal = realValues.length ? realValues.reduce((sum, value) => sum + value, 0) : null;

  return {
    ...line,
    monthly_values: monthly,
    projections,
    annual_budgeted: roundValue(annualBudgeted, decimals),
    annual_real: annualReal === null ? null : roundValue(annualReal, decimals),
    annual_variance: annualReal === null ? null : roundValue(annualReal - annualBudgeted, decimals),
    complete: monthly.length === 12 && projections.length === 3,
  };
}

function contextLines(database: DatabaseManager, request: Request) {
  const companyId = Number(request.query.company_id);
  const exerciseId = Number(request.query.exercise_id);
  const versionId = Number(request.query.version_id);
  getOriginalVersion(database, versionId, companyId, exerciseId);

  const conditions = ["company_id=?", "exercise_id=?", "version_id=?"];
  const params: unknown[] = [companyId, exerciseId, versionId];
  const filters: Array<[string, unknown]> = [
    ["center_id", request.query.center_id],
    ["group_id", request.query.group_id],
    ["element_id", request.query.element_id],
    ["account_id", request.query.account_id],
  ];
  for (const [field, raw] of filters) {
    const value = queryId(raw);
    if (value) {
      conditions.push(`${field}=?`);
      params.push(value);
    }
  }

  const ids = database.connection.prepare(`SELECT id FROM budget_original_lines
    WHERE ${conditions.join(" AND ")}
    ORDER BY center_id, group_id, element_id, account_id`).all(...params) as Array<{ id: number }>;
  return ids.map((item) => detailedLine(database, item.id));
}

export function registerOriginalBudgetRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/budget-original/lines", (request: Request, response: Response) => {
    response.json(contextLines(database, request));
  });

  app.get("/api/budget-original/summary", (request: Request, response: Response) => {
    const lines = contextLines(database, request) as Array<Record<string, unknown>>;
    const totalBudgeted = lines.reduce((sum, line) => sum + Number(line.annual_budgeted ?? 0), 0);
    const linesWithReal = lines.filter((line) => line.annual_real !== null);
    const totalReal = linesWithReal.length
      ? linesWithReal.reduce((sum, line) => sum + Number(line.annual_real ?? 0), 0)
      : null;
    response.json({
      line_count: lines.length,
      total_budgeted: totalBudgeted,
      total_real: totalReal,
      variance: totalReal === null ? null : totalReal - totalBudgeted,
      complete_lines: lines.filter((line) => line.complete).length,
      can_approve: lines.length > 0 && lines.every((line) => line.complete),
    });
  });

  app.get("/api/budget-original/lines/:id", (request: Request, response: Response) => {
    response.json(detailedLine(database, Number(request.params.id)));
  });

  app.post("/api/budget-original/lines", (request: Request, response: Response) => {
    const input = createLineSchema.parse(request.body);
    const version = getOriginalVersion(database, input.version_id, input.company_id, input.exercise_id, true);
    if (version.period_id) httpError("El presupuesto original debe utilizar una versión de alcance anual.");

    const dimensions = resolveDimensions(
      database,
      input.company_id,
      input.center_id,
      input.account_id,
      input.currency_id,
      input.unit_id,
      input.responsible_id,
    );
    const periods = getPeriods(database, input.company_id, input.exercise_id);
    const projectionYears = getProjectionYears(database, input.company_id, input.exercise_id);
    const stamp = new Date().toISOString();

    const id = database.connection.transaction(() => {
      const result = database.connection.prepare(`INSERT INTO budget_original_lines
        (company_id,exercise_id,version_id,center_id,group_id,element_id,account_id,currency_id,unit_id,
         responsible_id,comment,support,source_text,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        input.company_id,
        input.exercise_id,
        input.version_id,
        input.center_id,
        dimensions.groupId,
        dimensions.elementId,
        input.account_id,
        input.currency_id,
        input.unit_id ?? null,
        input.responsible_id ?? null,
        input.comment ?? null,
        input.support ?? null,
        input.source ?? null,
        stamp,
        stamp,
      );
      const lineId = Number(result.lastInsertRowid);
      const insertMonth = database.connection.prepare(`INSERT INTO budget_original_monthly_values
        (line_id,period_id,budgeted_value,real_value,created_at,updated_at) VALUES (?,?,0,NULL,?,?)`);
      periods.forEach((period) => insertMonth.run(lineId, period.id, stamp, stamp));
      const insertProjection = database.connection.prepare(`INSERT INTO budget_original_projections
        (line_id,projection_year_id,budgeted_value,real_value,created_at,updated_at) VALUES (?,?,0,NULL,?,?)`);
      projectionYears.forEach((projection) => insertProjection.run(lineId, projection.id, stamp, stamp));
      return lineId;
    })();

    audit(database, "CREAR", "budget_original_lines", id, input.company_id, "Línea de presupuesto original creada.", undefined, input);
    response.status(201).json({ id, message: "Línea presupuestal creada con doce meses y tres años de proyección." });
  });

  app.patch("/api/budget-original/lines/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = updateLineSchema.parse(request.body);
    const before = ensureEditableLine(database, id);
    const companyId = Number(before.company_id);
    const exerciseId = Number(before.exercise_id);
    const centerId = input.center_id ?? Number(before.center_id);
    const accountId = input.account_id ?? Number(before.account_id);
    const currencyId = input.currency_id ?? Number(before.currency_id);
    const unitId = input.unit_id === undefined ? nullableNumber(before.unit_id) : input.unit_id;
    const responsibleId = input.responsible_id === undefined ? nullableNumber(before.responsible_id) : input.responsible_id;
    const dimensions = resolveDimensions(database, companyId, centerId, accountId, currencyId, unitId, responsibleId);
    const periods = new Map(getPeriods(database, companyId, exerciseId).map((item) => [Number(item.id), item]));
    const projectionIds = new Set(getProjectionYears(database, companyId, exerciseId).map((item) => Number(item.id)));
    const stamp = new Date().toISOString();

    database.connection.transaction(() => {
      for (const value of input.monthly_values ?? []) {
        const period = periods.get(value.period_id);
        if (!period) httpError("Uno de los periodos no pertenece al ejercicio activo.");
        const current = database.connection.prepare(`SELECT * FROM budget_original_monthly_values
          WHERE line_id=? AND period_id=?`).get(id, value.period_id) as Record<string, unknown> | undefined;
        if (!current) httpError("No existe el registro mensual indicado.", 404);
        const nextReal = value.real_value === undefined ? nullableNumber(current.real_value) : value.real_value;
        const changed = Number(current.budgeted_value) !== value.budgeted_value
          || nullableNumber(current.real_value) !== nextReal;
        if (changed && String(period.status) === "CERRADO") {
          httpError(`El periodo ${String(period.name)} está cerrado y no puede modificarse.`, 409);
        }
        database.connection.prepare(`UPDATE budget_original_monthly_values
          SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?`).run(
          value.budgeted_value,
          nextReal,
          stamp,
          current.id,
        );
      }

      for (const value of input.projections ?? []) {
        if (!projectionIds.has(value.projection_year_id)) {
          httpError("Uno de los años proyectados no pertenece al ejercicio activo.");
        }
        const current = database.connection.prepare(`SELECT * FROM budget_original_projections
          WHERE line_id=? AND projection_year_id=?`).get(id, value.projection_year_id) as Record<string, unknown> | undefined;
        if (!current) httpError("No existe el registro de proyección indicado.", 404);
        database.connection.prepare(`UPDATE budget_original_projections
          SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?`).run(
          value.budgeted_value,
          value.real_value === undefined ? current.real_value : value.real_value,
          stamp,
          current.id,
        );
      }

      database.connection.prepare(`UPDATE budget_original_lines SET
        center_id=?,group_id=?,element_id=?,account_id=?,currency_id=?,unit_id=?,responsible_id=?,
        comment=?,support=?,source_text=?,updated_at=? WHERE id=?`).run(
        centerId,
        dimensions.groupId,
        dimensions.elementId,
        accountId,
        currencyId,
        unitId,
        responsibleId,
        input.comment === undefined ? before.comment : input.comment,
        input.support === undefined ? before.support : input.support,
        input.source === undefined ? before.source_text : input.source,
        stamp,
        id,
      );
    })();

    audit(database, "EDITAR", "budget_original_lines", id, companyId, "Línea de presupuesto original actualizada.", before, input);
    response.json({ message: "Línea presupuestal actualizada correctamente." });
  });

  app.post("/api/budget-original/lines/:id/distribute", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = distributeSchema.parse(request.body);
    const line = ensureEditableLine(database, id);
    const currency = database.connection.prepare("SELECT decimals FROM currencies WHERE id=?").get(line.currency_id) as { decimals: number };
    const values = database.connection.prepare(`SELECT mv.*, p.status, p.period_number
      FROM budget_original_monthly_values mv
      JOIN budget_periods p ON p.id=mv.period_id
      WHERE mv.line_id=? ORDER BY p.period_number`).all(id) as Array<Record<string, unknown>>;
    const closedTotal = values
      .filter((item) => item.status === "CERRADO")
      .reduce((sum, item) => sum + Number(item.budgeted_value), 0);
    const open = values.filter((item) => item.status === "ABIERTO");
    if (!open.length) httpError("No existen periodos abiertos para distribuir el total anual.", 409);

    const remaining = input.annual_total - closedTotal;
    const share = roundValue(remaining / open.length, currency.decimals);
    let assigned = 0;
    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      open.forEach((item, index) => {
        const amount = index === open.length - 1
          ? roundValue(remaining - assigned, currency.decimals)
          : share;
        assigned += amount;
        database.connection.prepare(`UPDATE budget_original_monthly_values
          SET budgeted_value=?,updated_at=? WHERE id=?`).run(amount, stamp, item.id);
      });
      database.connection.prepare("UPDATE budget_original_lines SET updated_at=? WHERE id=?").run(stamp, id);
    })();

    audit(database, "DISTRIBUIR", "budget_original_lines", id, Number(line.company_id), `Total anual ${input.annual_total} distribuido.`, undefined, input);
    response.json({ message: "Total anual distribuido entre los periodos abiertos." });
  });

  app.post("/api/budget-original/lines/:id/project", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = projectSchema.parse(request.body);
    const line = ensureEditableLine(database, id);
    const currency = database.connection.prepare("SELECT decimals FROM currencies WHERE id=?").get(line.currency_id) as { decimals: number };
    const annual = (database.connection.prepare(`SELECT COALESCE(SUM(budgeted_value),0) AS total
      FROM budget_original_monthly_values WHERE line_id=?`).get(id) as { total: number }).total;
    const projections = database.connection.prepare(`SELECT bp.id, py.sequence
      FROM budget_original_projections bp
      JOIN projection_years py ON py.id=bp.projection_year_id
      WHERE bp.line_id=? ORDER BY py.sequence`).all(id) as Array<{ id: number; sequence: number }>;
    if (projections.length !== 3) httpError("La línea no contiene los tres años de proyección.", 409);

    let projectedValue = Number(annual);
    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      projections.forEach((projection, index) => {
        const rate = input.rates[index];
        projectedValue = roundValue(projectedValue * (1 + rate / 100), currency.decimals);
        database.connection.prepare(`UPDATE budget_original_projections
          SET budgeted_value=?,updated_at=? WHERE id=?`).run(projectedValue, stamp, projection.id);
      });
    })();
    response.json({ message: "Proyección anual calculada para los tres años posteriores." });
  });

  app.post("/api/budget-original/lines/:id/copy", (request: Request, response: Response) => {
    const targetId = Number(request.params.id);
    const input = copySchema.parse(request.body);
    if (targetId === input.source_line_id) httpError("Seleccione una línea de origen diferente.");
    const target = ensureEditableLine(database, targetId);
    const source = getOriginalLine(database, input.source_line_id);
    if (Number(source.company_id) !== Number(target.company_id)
      || Number(source.exercise_id) !== Number(target.exercise_id)
      || Number(source.version_id) !== Number(target.version_id)) {
      httpError("La línea de origen debe pertenecer a la misma empresa, ejercicio y versión.");
    }

    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      const months = database.connection.prepare(`SELECT source.budgeted_value, source.real_value,
        target.id AS target_id, p.status
        FROM budget_original_monthly_values source
        JOIN budget_original_monthly_values target
          ON target.period_id=source.period_id AND target.line_id=?
        JOIN budget_periods p ON p.id=source.period_id
        WHERE source.line_id=?`).all(targetId, input.source_line_id) as Array<Record<string, unknown>>;
      for (const month of months) {
        if (month.status === "CERRADO") continue;
        database.connection.prepare(`UPDATE budget_original_monthly_values
          SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?`).run(
          month.budgeted_value,
          input.include_real ? month.real_value : null,
          stamp,
          month.target_id,
        );
      }

      const projections = database.connection.prepare(`SELECT source.budgeted_value, source.real_value,
        target.id AS target_id
        FROM budget_original_projections source
        JOIN budget_original_projections target
          ON target.projection_year_id=source.projection_year_id AND target.line_id=?
        WHERE source.line_id=?`).all(targetId, input.source_line_id) as Array<Record<string, unknown>>;
      for (const projection of projections) {
        database.connection.prepare(`UPDATE budget_original_projections
          SET budgeted_value=?,real_value=?,updated_at=? WHERE id=?`).run(
          projection.budgeted_value,
          input.include_real ? projection.real_value : null,
          stamp,
          projection.target_id,
        );
      }
      database.connection.prepare("UPDATE budget_original_lines SET updated_at=? WHERE id=?").run(stamp, targetId);
    })();

    response.json({ message: "Valores copiados dentro de la versión activa. Los periodos cerrados se conservaron." });
  });

  app.delete("/api/budget-original/lines/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const line = ensureEditableLine(database, id);
    database.connection.prepare("DELETE FROM budget_original_lines WHERE id=?").run(id);
    audit(database, "ELIMINAR", "budget_original_lines", id, Number(line.company_id), "Línea de presupuesto original eliminada.", line);
    response.json({ message: "Línea presupuestal eliminada correctamente." });
  });

  app.post("/api/budget-original/approve", (request: Request, response: Response) => {
    const input = approveSchema.parse(request.body);
    const version = getOriginalVersion(database, input.version_id, input.company_id, input.exercise_id, true);
    ensureResponsible(database, input.responsible_id, input.company_id, true);
    const totals = database.connection.prepare(`SELECT COUNT(*) AS lines,
      SUM(CASE WHEN month_count=12 AND projection_count=3 THEN 1 ELSE 0 END) AS complete_lines
      FROM (SELECT l.id,
        (SELECT COUNT(*) FROM budget_original_monthly_values mv WHERE mv.line_id=l.id) AS month_count,
        (SELECT COUNT(*) FROM budget_original_projections bp WHERE bp.line_id=l.id) AS projection_count
        FROM budget_original_lines l WHERE l.version_id=?)`).get(input.version_id) as { lines: number; complete_lines: number | null };
    if (!totals.lines) httpError("Registre al menos una línea presupuestal antes de aprobar.", 409);
    if (Number(totals.complete_lines) !== totals.lines) {
      httpError("Todas las líneas deben contener doce meses y tres años de proyección.", 409);
    }

    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      database.connection.prepare(`UPDATE budget_versions SET
        status='APROBADO',responsible_id=?,approved_at=?,updated_at=? WHERE id=?`).run(
        input.responsible_id,
        stamp,
        stamp,
        input.version_id,
      );
      database.connection.prepare(`INSERT INTO version_status_history
        (company_id,version_id,from_status,to_status,responsible_id,notes,created_at)
        VALUES (?,?,'BORRADOR','APROBADO',?,?,?)`).run(
        input.company_id,
        input.version_id,
        input.responsible_id,
        input.notes,
        stamp,
      );
    })();

    audit(database, "APROBAR", "budget_versions", input.version_id, input.company_id,
      `Presupuesto original ${String(version.code)} aprobado.`, version, { ...version, status: "APROBADO" });
    response.json({ message: "Presupuesto original aprobado y bloqueado para edición." });
  });
}
