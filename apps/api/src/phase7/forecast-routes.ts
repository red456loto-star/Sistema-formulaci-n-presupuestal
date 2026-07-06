import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit } from "../phase2/common";
import { httpError } from "../phase3/common";
import {
  addVersionHistory,
  ensureResponsible,
  getForecastVersion,
  getPhase7Context,
  numericId,
  optionalText,
  roundAmount,
} from "./common";

const positiveId = z.coerce.number().int().positive();
const createSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  original_version_id: positiveId,
  cutoff_period_number: z.coerce.number().int().min(1).max(12),
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  responsible_id: positiveId,
  observation: z.string().trim().min(2).max(1000),
});

const lineUpdateSchema = z.object({
  projected_value: z.coerce.number().finite(),
  comment: z.string().trim().max(1000).optional().nullable(),
  source_reference: z.string().trim().min(2).max(1000),
  responsible_id: positiveId.optional().nullable(),
});

const approveSchema = z.object({
  responsible_id: positiveId,
  observation: z.string().trim().min(2).max(1000),
});

function nextForecastNumber(database: DatabaseManager, exerciseId: number) {
  const row = database.connection.prepare("SELECT COALESCE(MAX(version_number),0)+1 next_number FROM budget_versions WHERE exercise_id=? AND version_type='FORECAST'")
    .get(exerciseId) as { next_number: number };
  return Number(row.next_number);
}

function nextRevisionNumber(database: DatabaseManager, originalVersionId: number) {
  const row = database.connection.prepare("SELECT COALESCE(MAX(revision_number),0)+1 next_number FROM forecast_profiles WHERE original_version_id=?")
    .get(originalVersionId) as { next_number: number };
  return Number(row.next_number);
}

function forecastLines(database: DatabaseManager, versionId: number) {
  const version = getForecastVersion(database, versionId);
  const rows = database.connection.prepare(`SELECT fv.*,
    p.period_number,p.name period_name,p.status period_status,
    c.code center_code,c.name center_name,
    g.code group_code,g.name group_name,
    e.code element_code,e.name element_name,
    a.code account_code,a.name account_name,a.nature account_nature,
    r.full_name responsible_name
    FROM forecast_values fv
    JOIN budget_periods p ON p.id=fv.period_id
    JOIN activity_centers c ON c.id=fv.center_id
    JOIN budget_groups g ON g.id=fv.group_id
    JOIN budget_elements e ON e.id=fv.element_id
    JOIN budget_accounts a ON a.id=fv.account_id
    LEFT JOIN responsibles r ON r.id=fv.responsible_id
    WHERE fv.forecast_version_id=?
    ORDER BY p.period_number,c.code,a.code`).all(versionId) as Array<Record<string, unknown>>;
  return { version, rows: rows.map((row) => ({
    ...row,
    difference: roundAmount(Number(row.forecast_value) - Number(row.original_budget)),
  })) };
}

function forecastSummary(database: DatabaseManager, versionId: number) {
  const { version, rows } = forecastLines(database, versionId);
  const months = Array.from({ length: 12 }, (_, index) => {
    const periodNumber = index + 1;
    const periodRows = rows.filter((row) => Number(row.period_number) === periodNumber);
    const original = periodRows.reduce((sum, row) => sum + Number(row.original_budget), 0);
    const realRows = periodRows.filter((row) => row.actual_value !== null);
    const actual = realRows.length ? realRows.reduce((sum, row) => sum + Number(row.actual_value), 0) : null;
    const forecast = periodRows.reduce((sum, row) => sum + Number(row.forecast_value), 0);
    return {
      period_number: periodNumber,
      period_name: String(periodRows[0]?.period_name ?? periodNumber),
      original_budget: roundAmount(original),
      actual_value: actual === null ? null : roundAmount(actual),
      forecast_value: roundAmount(forecast),
      difference: roundAmount(forecast - original),
      value_origin: periodNumber <= Number(version.cutoff_period_number) ? "REAL" : "PROYECCION",
    };
  });
  const annualOriginal = rows.reduce((sum, row) => sum + Number(row.original_budget), 0);
  const annualReal = rows.filter((row) => row.actual_value !== null).reduce((sum, row) => sum + Number(row.actual_value), 0);
  const annualForecast = rows.reduce((sum, row) => sum + Number(row.forecast_value), 0);
  return {
    version,
    monthly: months,
    annual: {
      original_budget: roundAmount(annualOriginal),
      actual_to_cutoff: roundAmount(annualReal),
      forecast_value: roundAmount(annualForecast),
      difference: roundAmount(annualForecast - annualOriginal),
    },
    complete: rows.length > 0 && rows.every((row) => row.value_origin === "REAL" ? row.actual_value !== null : row.projected_value !== null),
    line_count: rows.length,
  };
}

export function registerForecastRoutes(app: Express, database: DatabaseManager) {
  app.get("/api/forecasts", (request: Request, response: Response) => {
    const companyId = numericId(request.query.company_id,"una empresa");
    const exerciseId = numericId(request.query.exercise_id,"un ejercicio");
    response.json(database.connection.prepare(`SELECT v.*,fp.original_version_id,fp.cutoff_period_number,fp.revision_number,
      fp.observation,source.code source_version_code,source.name source_version_name,
      p.name cutoff_period_name,r.full_name responsible_name
      FROM budget_versions v
      JOIN forecast_profiles fp ON fp.forecast_version_id=v.id
      JOIN budget_versions source ON source.id=fp.original_version_id
      JOIN budget_periods p ON p.exercise_id=v.exercise_id AND p.period_number=fp.cutoff_period_number
      LEFT JOIN responsibles r ON r.id=v.responsible_id
      WHERE v.company_id=? AND v.exercise_id=?
      ORDER BY fp.revision_number DESC`).all(companyId,exerciseId));
  });

  app.post("/api/forecasts", (request: Request, response: Response) => {
    const input = createSchema.parse(request.body);
    const context = getPhase7Context(database,input.company_id,input.exercise_id,input.original_version_id,true);
    ensureResponsible(database,input.company_id,input.responsible_id,true);
    const cutoffPeriod = database.connection.prepare("SELECT * FROM budget_periods WHERE company_id=? AND exercise_id=? AND period_number=?")
      .get(input.company_id,input.exercise_id,input.cutoff_period_number) as Record<string, unknown> | undefined;
    if (!cutoffPeriod) httpError("El mes de corte no pertenece al ejercicio activo.", 400);

    const originalRows = database.connection.prepare(`SELECT l.company_id,l.exercise_id,l.version_id original_version_id,
      l.center_id,l.group_id,l.element_id,l.account_id,mv.period_id,mv.budgeted_value,p.period_number
      FROM budget_original_lines l
      JOIN budget_original_monthly_values mv ON mv.line_id=l.id
      JOIN budget_periods p ON p.id=mv.period_id
      WHERE l.version_id=? ORDER BY p.period_number,l.center_id,l.account_id`).all(input.original_version_id) as Array<Record<string, unknown>>;
    if (!originalRows.length) httpError("La versión original no contiene líneas presupuestales.", 409);

    const missing: string[] = [];
    for (const row of originalRows.filter((item) => Number(item.period_number) <= input.cutoff_period_number)) {
      const actual = database.connection.prepare(`SELECT id FROM actual_values
        WHERE original_version_id=? AND period_id=? AND center_id=? AND account_id=? AND budget_type='PRESUPUESTO_ORIGINAL'`)
        .get(input.original_version_id,row.period_id,row.center_id,row.account_id);
      if (!actual) missing.push(`mes ${row.period_number}, centro ${row.center_id}, cuenta ${row.account_id}`);
    }
    if (missing.length) {
      httpError(`Faltan datos reales hasta el mes de corte (${missing.slice(0,5).join("; ")}${missing.length > 5 ? "; ..." : ""}).`, 409);
    }

    const versionNumber = nextForecastNumber(database,input.exercise_id);
    const revisionNumber = nextRevisionNumber(database,input.original_version_id);
    const stamp = new Date().toISOString();
    const forecastVersionId = database.connection.transaction(() => {
      const versionResult = database.connection.prepare(`INSERT INTO budget_versions
        (company_id,exercise_id,period_id,source_version_id,copied_from_version_id,responsible_id,code,name,version_type,version_number,status,notes,created_at,updated_at)
        VALUES (?,?,?,?,NULL,?,?,?,'FORECAST',?,'BORRADOR',?,?,?)`).run(
        input.company_id,input.exercise_id,cutoffPeriod.id,input.original_version_id,input.responsible_id,input.code,input.name,
        versionNumber,input.observation,stamp,stamp,
      );
      const versionId = Number(versionResult.lastInsertRowid);
      database.connection.prepare(`INSERT INTO forecast_profiles
        (company_id,exercise_id,forecast_version_id,original_version_id,cutoff_period_number,revision_number,responsible_id,observation,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        input.company_id,input.exercise_id,versionId,input.original_version_id,input.cutoff_period_number,revisionNumber,input.responsible_id,input.observation,stamp,stamp,
      );
      const insert = database.connection.prepare(`INSERT INTO forecast_values
        (company_id,exercise_id,forecast_version_id,original_version_id,period_id,center_id,group_id,element_id,account_id,
         original_budget,actual_value,projected_value,forecast_value,value_origin,comment,source_reference,responsible_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const row of originalRows) {
        const isReal = Number(row.period_number) <= input.cutoff_period_number;
        const actual = isReal
          ? database.connection.prepare(`SELECT actual_value,source_reference,responsible_id,comment FROM actual_values
              WHERE original_version_id=? AND period_id=? AND center_id=? AND account_id=? AND budget_type='PRESUPUESTO_ORIGINAL'`)
            .get(input.original_version_id,row.period_id,row.center_id,row.account_id) as Record<string, unknown>
          : undefined;
        const original = Number(row.budgeted_value);
        const actualValue = isReal ? Number(actual.actual_value) : null;
        const projected = isReal ? null : original;
        const forecast = isReal ? actualValue : original;
        insert.run(
          input.company_id,input.exercise_id,versionId,input.original_version_id,row.period_id,row.center_id,row.group_id,row.element_id,row.account_id,
          original,actualValue,projected,forecast,isReal ? "REAL" : "PROYECCION",isReal ? actual.comment ?? null : null,
          isReal ? actual.source_reference : "Proyección inicial igual al presupuesto original",isReal ? actual.responsible_id ?? null : input.responsible_id,stamp,stamp,
        );
      }
      const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=?").get(versionId) as Record<string, unknown>;
      addVersionHistory(database,version,null,"BORRADOR",input.responsible_id,`Forecast revisión ${revisionNumber} creado con corte en ${cutoffPeriod.name}.`);
      return versionId;
    })();
    audit(database,"CREAR","budget_versions",forecastVersionId,input.company_id,`Forecast ${input.code} creado desde ${context.originalVersion.code}.`,undefined,input);
    response.status(201).json({ id: forecastVersionId, version_number: versionNumber, revision_number: revisionNumber, message: "Forecast creado con información real hasta el corte y proyección posterior." });
  });

  app.get("/api/forecasts/:id", (request: Request, response: Response) => {
    const id = Number(request.params.id);
    const detail = forecastLines(database,id);
    response.json({ ...detail, summary: forecastSummary(database,id) });
  });

  app.get("/api/forecasts/:id/summary", (request: Request, response: Response) => {
    response.json(forecastSummary(database,Number(request.params.id)));
  });

  app.patch("/api/forecasts/:id/lines/:lineId", (request: Request, response: Response) => {
    const versionId = Number(request.params.id);
    const lineId = Number(request.params.lineId);
    const input = lineUpdateSchema.parse(request.body);
    const version = getForecastVersion(database,versionId,true);
    ensureResponsible(database,Number(version.company_id),input.responsible_id);
    const before = database.connection.prepare(`SELECT fv.*,p.period_number,p.name period_name FROM forecast_values fv
      JOIN budget_periods p ON p.id=fv.period_id WHERE fv.id=? AND fv.forecast_version_id=?`).get(lineId,versionId) as Record<string, unknown> | undefined;
    if (!before) httpError("La línea forecast no existe.", 404);
    if (String(before.value_origin) === "REAL" || Number(before.period_number) <= Number(version.cutoff_period_number)) {
      httpError("Los meses hasta el corte provienen de información real y no pueden reemplazarse con proyección.", 409);
    }
    database.connection.prepare(`UPDATE forecast_values SET projected_value=?,forecast_value=?,comment=?,source_reference=?,responsible_id=?,updated_at=? WHERE id=?`)
      .run(input.projected_value,input.projected_value,optionalText(input.comment),input.source_reference,input.responsible_id ?? null,new Date().toISOString(),lineId);
    audit(database,"EDITAR","forecast_values",lineId,Number(version.company_id),`Proyección forecast actualizada para ${before.period_name}.`,before,input);
    response.json({ message: "Proyección forecast actualizada." });
  });

  app.post("/api/forecasts/:id/approve", (request: Request, response: Response) => {
    const versionId = Number(request.params.id);
    const input = approveSchema.parse(request.body);
    const version = getForecastVersion(database,versionId,true);
    ensureResponsible(database,Number(version.company_id),input.responsible_id,true);
    const incomplete = database.connection.prepare(`SELECT COUNT(*) total FROM forecast_values
      WHERE forecast_version_id=? AND ((value_origin='REAL' AND actual_value IS NULL) OR (value_origin='PROYECCION' AND projected_value IS NULL))`)
      .get(versionId) as { total: number };
    if (Number(incomplete.total) > 0) httpError("El forecast contiene líneas incompletas y no puede aprobarse.", 409);
    const stamp = new Date().toISOString();
    database.connection.transaction(() => {
      database.connection.prepare("UPDATE budget_versions SET status='APROBADO',responsible_id=?,approved_at=?,notes=?,updated_at=? WHERE id=?")
        .run(input.responsible_id,stamp,input.observation,stamp,versionId);
      database.connection.prepare("UPDATE forecast_profiles SET responsible_id=?,observation=?,updated_at=? WHERE forecast_version_id=?")
        .run(input.responsible_id,input.observation,stamp,versionId);
      addVersionHistory(database,version,"BORRADOR","APROBADO",input.responsible_id,input.observation);
    })();
    audit(database,"APROBAR","budget_versions",versionId,Number(version.company_id),`Forecast ${version.code} aprobado.`,version,{ ...version,status:"APROBADO" });
    response.json({ message: "Forecast aprobado y bloqueado para edición." });
  });
}
