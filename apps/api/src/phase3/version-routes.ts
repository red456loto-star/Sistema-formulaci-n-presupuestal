import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit, codeField, nullableText, positiveId, requireCompanyId, text } from "../phase2/common";
import { ensureExercise, ensurePeriod, ensureResponsible, ensureTemporalCompany, httpError, versionType } from "./common";

const createVersionSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  period_id: positiveId.optional().nullable(),
  source_version_id: positiveId.optional().nullable(),
  responsible_id: positiveId.optional().nullable(),
  code: codeField(2, 40),
  name: text(2, 160),
  version_type: versionType,
  version_number: z.coerce.number().int().positive().optional(),
  notes: nullableText(500),
});

const updateVersionSchema = z.object({
  code: codeField(2, 40).optional(),
  name: text(2, 160).optional(),
  period_id: positiveId.optional().nullable(),
  responsible_id: positiveId.optional().nullable(),
  notes: nullableText(500),
});

const statusActionSchema = z.object({
  responsible_id: positiveId,
  notes: z.string().trim().min(2).max(500),
});

const copySchema = z.object({
  code: codeField(2, 40),
  name: text(2, 160),
  responsible_id: positiveId.optional().nullable(),
  notes: nullableText(500),
});

const replaceSchema = statusActionSchema.extend({ replacement_version_id: positiveId });

function getVersion(database: DatabaseManager, id: number) {
  const row = database.connection.prepare("SELECT * FROM budget_versions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) httpError("Versión no encontrada.", 404);
  return row;
}

function validateSource(database: DatabaseManager, companyId: number, exerciseId: number, versionTypeValue: string, sourceId: number | null | undefined) {
  if (versionTypeValue === "ORIGINAL") {
    if (sourceId) httpError("Una versión original no debe vincularse a un presupuesto original de origen.");
    return null;
  }
  if (!sourceId) httpError("Seleccione la versión original que servirá como base del forecast.");
  const source = getVersion(database, sourceId);
  if (Number(source.company_id) !== companyId || Number(source.exercise_id) !== exerciseId || String(source.version_type) !== "ORIGINAL") {
    httpError("La versión de origen debe ser un presupuesto original del mismo ejercicio y empresa.");
  }
  if (!["APROBADO", "CERRADO"].includes(String(source.status))) httpError("La versión original debe estar aprobada o cerrada antes de crear un forecast.", 409);
  return sourceId;
}

function nextVersionNumber(database: DatabaseManager, exerciseId: number, type: string) {
  const row = database.connection.prepare("SELECT COALESCE(MAX(version_number), 0) + 1 AS next_number FROM budget_versions WHERE exercise_id = ? AND version_type = ?").get(exerciseId, type) as { next_number: number };
  return row.next_number;
}

function addHistory(database: DatabaseManager, version: Record<string, unknown>, fromStatus: string | null, toStatus: string, responsibleId: number | null, notes: string | null) {
  database.connection.prepare(`INSERT INTO version_status_history
    (company_id, version_id, from_status, to_status, responsible_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(version.company_id, version.id, fromStatus, toStatus, responsibleId, notes, new Date().toISOString());
}

export function registerVersionRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/catalog/versiones", (request: Request, response: Response) => {
    const companyId = requireCompanyId(request.query.company_id);
    const exerciseId = Number(request.query.exercise_id);
    ensureTemporalCompany(database, companyId);
    ensureExercise(database, exerciseId, companyId);
    response.json(database.connection.prepare(`SELECT v.*, e.budget_year, p.name AS period_name,
      r.full_name AS responsible_name, source.code AS source_version_code,
      copied.code AS copied_from_code
      FROM budget_versions v
      JOIN budget_exercises e ON e.id = v.exercise_id
      LEFT JOIN budget_periods p ON p.id = v.period_id
      LEFT JOIN responsibles r ON r.id = v.responsible_id
      LEFT JOIN budget_versions source ON source.id = v.source_version_id
      LEFT JOIN budget_versions copied ON copied.id = v.copied_from_version_id
      WHERE v.company_id = ? AND v.exercise_id = ?
      ORDER BY v.version_type, v.version_number DESC`).all(companyId, exerciseId));
  });

  app.post("/api/catalog/versiones", (request: Request, response: Response) => {
    const input = createVersionSchema.parse(request.body);
    ensureTemporalCompany(database, input.company_id);
    ensureExercise(database, input.exercise_id, input.company_id);
    if (input.period_id) ensurePeriod(database, input.period_id, input.exercise_id, input.company_id);
    ensureResponsible(database, input.responsible_id, input.company_id);
    const sourceId = validateSource(database, input.company_id, input.exercise_id, input.version_type, input.source_version_id);
    const number = input.version_number ?? nextVersionNumber(database, input.exercise_id, input.version_type);
    const stamp = new Date().toISOString();
    const id = database.connection.transaction(() => {
      const result = database.connection.prepare(`INSERT INTO budget_versions
        (company_id, exercise_id, period_id, source_version_id, copied_from_version_id, responsible_id, code, name, version_type, version_number, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'BORRADOR', ?, ?, ?)`)
        .run(input.company_id, input.exercise_id, input.period_id ?? null, sourceId, input.responsible_id ?? null, input.code, input.name, input.version_type, number, input.notes ?? null, stamp, stamp);
      const versionId = Number(result.lastInsertRowid);
      const version = getVersion(database, versionId);
      addHistory(database, version, null, "BORRADOR", input.responsible_id ?? null, "Versión creada.");
      return versionId;
    })();
    audit(database, "CREAR", "budget_versions", id, input.company_id, `Versión ${input.code} creada.`, undefined, input);
    response.status(201).json({ id, version_number: number, message: "Versión creada correctamente." });
  });

  app.patch("/api/catalog/versiones/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = updateVersionSchema.parse(request.body);
    const before = getVersion(database, id);
    if (String(before.status) !== "BORRADOR") httpError("Solo las versiones en borrador pueden editarse.", 409);
    const companyId = Number(before.company_id);
    if (input.period_id) ensurePeriod(database, input.period_id, Number(before.exercise_id), companyId);
    ensureResponsible(database, input.responsible_id, companyId);
    const values = { ...before, ...input } as Record<string, unknown>;
    database.connection.prepare(`UPDATE budget_versions SET code=?, name=?, period_id=?, responsible_id=?, notes=?, updated_at=? WHERE id=?`)
      .run(values.code, values.name, values.period_id ?? null, values.responsible_id ?? null, values.notes ?? null, new Date().toISOString(), id);
    audit(database, "EDITAR", "budget_versions", id, companyId, "Versión actualizada.", before, values);
    response.json({ message: "Versión actualizada correctamente." });
  });

  app.post("/api/catalog/versiones/:id/copiar", (request: Request, response: Response) => {
    const source = getVersion(database, Number(request.params.id));
    const input = copySchema.parse(request.body);
    const companyId = Number(source.company_id);
    ensureResponsible(database, input.responsible_id, companyId);
    const number = nextVersionNumber(database, Number(source.exercise_id), String(source.version_type));
    const stamp = new Date().toISOString();
    const newId = database.connection.transaction(() => {
      const result = database.connection.prepare(`INSERT INTO budget_versions
        (company_id, exercise_id, period_id, source_version_id, copied_from_version_id, responsible_id, code, name, version_type, version_number, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BORRADOR', ?, ?, ?)`)
        .run(companyId, source.exercise_id, source.period_id ?? null, source.source_version_id ?? null, source.id, input.responsible_id ?? source.responsible_id ?? null, input.code, input.name, source.version_type, number, input.notes ?? null, stamp, stamp);
      const id = Number(result.lastInsertRowid);
      addHistory(database, getVersion(database, id), null, "BORRADOR", input.responsible_id ?? null, `Copia de la versión ${source.code}.`);
      return id;
    })();
    audit(database, "COPIAR", "budget_versions", newId, companyId, `Versión copiada desde ${source.code}.`, source, { id: newId, ...input });
    response.status(201).json({ id: newId, version_number: number, message: "Versión copiada correctamente." });
  });

  app.post("/api/catalog/versiones/:id/aprobar", (request: Request, response: Response) => {
    changeStatus(database, Number(request.params.id), "BORRADOR", "APROBADO", statusActionSchema.parse(request.body));
    response.json({ message: "Versión aprobada correctamente." });
  });

  app.post("/api/catalog/versiones/:id/cerrar", (request: Request, response: Response) => {
    changeStatus(database, Number(request.params.id), "APROBADO", "CERRADO", statusActionSchema.parse(request.body));
    response.json({ message: "Versión cerrada correctamente." });
  });

  app.post("/api/catalog/versiones/:id/reemplazar", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const input = replaceSchema.parse(request.body);
    const current = getVersion(database, id);
    if (!["APROBADO", "CERRADO"].includes(String(current.status))) httpError("Solo una versión aprobada o cerrada puede marcarse como reemplazada.", 409);
    const replacement = getVersion(database, input.replacement_version_id);
    if (Number(replacement.company_id) !== Number(current.company_id) || Number(replacement.exercise_id) !== Number(current.exercise_id)) httpError("La versión sustituta debe pertenecer a la misma empresa y ejercicio.");
    if (!(["APROBADO", "CERRADO"].includes(String(replacement.status)))) httpError("La versión sustituta debe estar aprobada o cerrada.", 409);
    if (String(replacement.version_type) !== String(current.version_type)) httpError("La versión sustituta debe ser del mismo tipo.");
    ensureResponsible(database, input.responsible_id, Number(current.company_id), true);
    const stamp = new Date().toISOString();
    database.connection.prepare("UPDATE budget_versions SET status='REEMPLAZADO', updated_at=? WHERE id=?").run(stamp, id);
    addHistory(database, current, String(current.status), "REEMPLAZADO", input.responsible_id, `${input.notes} Sustituida por ${replacement.code}.`);
    audit(database, "REEMPLAZAR", "budget_versions", id, Number(current.company_id), `Versión ${current.code} reemplazada por ${replacement.code}.`, current, { ...current, status: "REEMPLAZADO" });
    response.json({ message: "Versión marcada como reemplazada." });
  });

  app.get("/api/catalog/versiones/:id/historial", (request: Request, response: Response) => {
    const version = getVersion(database, Number(request.params.id));
    response.json(database.connection.prepare(`SELECT h.*, r.full_name AS responsible_name
      FROM version_status_history h
      LEFT JOIN responsibles r ON r.id = h.responsible_id
      WHERE h.version_id = ? ORDER BY h.created_at DESC`).all(version.id));
  });
}

function changeStatus(database: DatabaseManager, id: number, requiredStatus: string, nextStatus: "APROBADO" | "CERRADO", input: z.infer<typeof statusActionSchema>) {
  const before = getVersion(database, id);
  if (String(before.status) !== requiredStatus) httpError(`La versión debe estar en estado ${requiredStatus.toLowerCase()} para realizar esta acción.`, 409);
  const companyId = Number(before.company_id);
  ensureResponsible(database, input.responsible_id, companyId, true);
  const stamp = new Date().toISOString();
  const dateField = nextStatus === "APROBADO" ? "approved_at" : "closed_at";
  database.connection.prepare(`UPDATE budget_versions SET status=?, responsible_id=?, ${dateField}=?, updated_at=? WHERE id=?`)
    .run(nextStatus, input.responsible_id, stamp, stamp, id);
  addHistory(database, before, requiredStatus, nextStatus, input.responsible_id, input.notes);
  audit(database, nextStatus === "APROBADO" ? "APROBAR" : "CERRAR", "budget_versions", id, companyId, `Versión ${before.code} en estado ${nextStatus}.`, before, { ...before, status: nextStatus });
}
