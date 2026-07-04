import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { activeField, audit, codeField, normalizeActive, nullableText, positiveId, requireCompanyId } from "../phase2/common";
import { annualDates, budgetYearField, ensureCurrency, ensureExercise, ensureResponsible, ensureTemporalCompany, httpError, monthDates, monthNames } from "./common";

const exerciseSchema = z.object({
  company_id: positiveId,
  code: codeField(2, 30),
  budget_year: budgetYearField,
  currency_id: positiveId,
  notes: nullableText(500),
  active: activeField,
});

const periodActionSchema = z.object({
  responsible_id: positiveId,
  notes: z.string().trim().min(2).max(500),
});

export function registerExerciseRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/catalog/ejercicios", (request: Request, response: Response) => {
    const companyId = requireCompanyId(request.query.company_id);
    ensureTemporalCompany(database, companyId);
    response.json(database.connection.prepare(`SELECT e.*, c.code AS currency_code,
      (SELECT COUNT(*) FROM budget_periods p WHERE p.exercise_id = e.id) AS period_count,
      (SELECT COUNT(*) FROM budget_versions v WHERE v.exercise_id = e.id) AS version_count
      FROM budget_exercises e
      JOIN currencies c ON c.id = e.currency_id
      WHERE e.company_id = ?
      ORDER BY e.budget_year DESC`).all(companyId));
  });

  app.post("/api/catalog/ejercicios", (request: Request, response: Response) => {
    const input = exerciseSchema.parse(request.body);
    ensureTemporalCompany(database, input.company_id);
    ensureCurrency(database, input.currency_id);
    const dates = annualDates(input.budget_year);
    const stamp = new Date().toISOString();

    const id = database.connection.transaction(() => {
      const result = database.connection.prepare(`INSERT INTO budget_exercises
        (company_id, code, budget_year, start_date, end_date, currency_id, notes, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(input.company_id, input.code, input.budget_year, dates.startDate, dates.endDate, input.currency_id, input.notes ?? null, normalizeActive(input.active ?? 1), stamp, stamp);
      const exerciseId = Number(result.lastInsertRowid);

      const insertPeriod = database.connection.prepare(`INSERT INTO budget_periods
        (company_id, exercise_id, period_number, name, start_date, end_date, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ABIERTO', NULL, ?, ?)`);
      for (let month = 1; month <= 12; month += 1) {
        const monthRange = monthDates(input.budget_year, month);
        insertPeriod.run(input.company_id, exerciseId, month, monthNames[month - 1], monthRange.startDate, monthRange.endDate, stamp, stamp);
      }

      const insertProjection = database.connection.prepare(`INSERT INTO projection_years
        (company_id, exercise_id, sequence, year, description, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`);
      for (let sequence = 1; sequence <= 3; sequence += 1) {
        const year = input.budget_year + sequence;
        insertProjection.run(input.company_id, exerciseId, sequence, year, `Proyección anual ${year}`, stamp, stamp);
      }
      return exerciseId;
    })();

    audit(database, "CREAR", "budget_exercises", id, input.company_id, `Ejercicio ${input.code} creado con 12 periodos y 3 años proyectados.`, undefined, input);
    response.status(201).json({ id, message: "Ejercicio creado con doce periodos y tres años de proyección." });
  });

  app.patch("/api/catalog/ejercicios/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = exerciseSchema.partial().parse(request.body);
    const before = ensureExercise(database, id);
    const companyId = Number(input.company_id ?? before.company_id);
    ensureTemporalCompany(database, companyId);
    if (companyId !== Number(before.company_id)) httpError("No se puede trasladar un ejercicio a otra empresa.");
    if (input.budget_year !== undefined && input.budget_year !== Number(before.budget_year)) httpError("El año presupuestado no puede cambiarse después de generar sus periodos.");
    const currencyId = Number(input.currency_id ?? before.currency_id);
    ensureCurrency(database, currencyId);
    const values = { ...before, ...input, active: normalizeActive(input.active ?? before.active), currency_id: currencyId } as Record<string, unknown>;
    database.connection.prepare(`UPDATE budget_exercises SET code=?, currency_id=?, notes=?, active=?, updated_at=? WHERE id=?`)
      .run(values.code, values.currency_id, values.notes ?? null, values.active, new Date().toISOString(), id);
    audit(database, "EDITAR", "budget_exercises", id, companyId, "Ejercicio actualizado.", before, values);
    response.json({ message: "Ejercicio actualizado correctamente." });
  });

  app.delete("/api/catalog/ejercicios/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const before = ensureExercise(database, id);
    const protectedVersions = database.connection.prepare("SELECT COUNT(*) AS total FROM budget_versions WHERE exercise_id = ? AND status <> 'BORRADOR'").get(id) as { total: number };
    if (protectedVersions.total > 0) httpError("No se puede desactivar un ejercicio con versiones aprobadas, cerradas o reemplazadas.", 409);
    database.connection.prepare("UPDATE budget_exercises SET active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    audit(database, "ELIMINAR", "budget_exercises", id, Number(before.company_id), "Ejercicio desactivado.", before, { ...before, active: 0 });
    response.json({ message: "Ejercicio desactivado correctamente." });
  });

  app.get("/api/catalog/periodos", (request: Request, response: Response) => {
    const companyId = requireCompanyId(request.query.company_id);
    const exerciseId = Number(request.query.exercise_id);
    ensureTemporalCompany(database, companyId);
    ensureExercise(database, exerciseId, companyId);
    response.json(database.connection.prepare(`SELECT p.*,
      closed.full_name AS closed_responsible_name,
      reopened.full_name AS reopened_responsible_name
      FROM budget_periods p
      LEFT JOIN responsibles closed ON closed.id = p.closed_responsible_id
      LEFT JOIN responsibles reopened ON reopened.id = p.reopened_responsible_id
      WHERE p.company_id = ? AND p.exercise_id = ?
      ORDER BY p.period_number`).all(companyId, exerciseId));
  });

  app.post("/api/catalog/periodos/:id/cerrar", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = periodActionSchema.parse(request.body);
    const row = database.connection.prepare("SELECT * FROM budget_periods WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) httpError("Periodo no encontrado.", 404);
    if (String(row.status) === "CERRADO") httpError("El periodo ya se encuentra cerrado.", 409);
    ensureResponsible(database, input.responsible_id, Number(row.company_id), true);
    const stamp = new Date().toISOString();
    database.connection.prepare(`UPDATE budget_periods SET status='CERRADO', closed_at=?, closed_responsible_id=?, close_notes=?, updated_at=? WHERE id=?`)
      .run(stamp, input.responsible_id, input.notes, stamp, id);
    audit(database, "CERRAR", "budget_periods", id, Number(row.company_id), `Periodo ${row.name} cerrado.`, row, { ...row, status: "CERRADO" });
    response.json({ message: "Periodo cerrado correctamente." });
  });

  app.post("/api/catalog/periodos/:id/reabrir", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = periodActionSchema.parse(request.body);
    const row = database.connection.prepare("SELECT * FROM budget_periods WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) httpError("Periodo no encontrado.", 404);
    if (String(row.status) === "ABIERTO") httpError("El periodo ya se encuentra abierto.", 409);
    ensureResponsible(database, input.responsible_id, Number(row.company_id), true);
    const stamp = new Date().toISOString();
    database.connection.prepare(`UPDATE budget_periods SET status='ABIERTO', reopened_at=?, reopened_responsible_id=?, reopen_notes=?, updated_at=? WHERE id=?`)
      .run(stamp, input.responsible_id, input.notes, stamp, id);
    audit(database, "REABRIR", "budget_periods", id, Number(row.company_id), `Periodo ${row.name} reabierto.`, row, { ...row, status: "ABIERTO" });
    response.json({ message: "Periodo reabierto correctamente." });
  });

  app.get("/api/catalog/proyecciones", (request: Request, response: Response) => {
    const companyId = requireCompanyId(request.query.company_id);
    const exerciseId = Number(request.query.exercise_id);
    ensureTemporalCompany(database, companyId);
    ensureExercise(database, exerciseId, companyId);
    response.json(database.connection.prepare("SELECT * FROM projection_years WHERE company_id = ? AND exercise_id = ? ORDER BY sequence").all(companyId, exerciseId));
  });
}
