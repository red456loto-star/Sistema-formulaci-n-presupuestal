import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit } from "../phase2/common";
import { httpError } from "../phase3/common";
import type { AnalysisDescriptor } from "./calculations";
import {
  buildCorrectedFinancialSnapshot,
  buildCorrectedHorizontalAnalysis,
  buildHorizontalWorkbook,
} from "./corrections";

const positiveId = z.coerce.number().int().positive();
const sourceTypeSchema = z.enum(["ORIGINAL", "FORECAST", "REAL"]);
const descriptorSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  source_type: sourceTypeSchema,
  period_number: z.union([z.null(), z.coerce.number().int().min(1).max(12)]).optional(),
});

const sectionSchema = z.enum([
  "SALES",
  "COST_OF_SALES",
  "OPERATING_EXPENSE",
  "INCOME_TAX",
  "CURRENT_ASSET",
  "NONCURRENT_ASSET",
  "CURRENT_LIABILITY",
  "NONCURRENT_LIABILITY",
  "EQUITY",
  "IGNORE",
]);

const mappingBatchSchema = z.object({
  company_id: positiveId,
  mappings: z.array(z.object({
    account_id: positiveId,
    statement_section: sectionSchema.nullable(),
    ratio_role: z.enum(["CASH", "RECEIVABLES", "INVENTORY", "OTHER"]).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })).max(5000),
});

const horizontalSchema = z.object({
  initial: descriptorSchema,
  final: descriptorSchema,
});

function descriptorFromQuery(request: Request): AnalysisDescriptor {
  return descriptorSchema.parse({
    company_id: request.query.company_id,
    exercise_id: request.query.exercise_id,
    version_id: request.query.version_id,
    source_type: request.query.source_type,
    period_number: request.query.period_number === undefined || request.query.period_number === ""
      ? null
      : request.query.period_number,
  }) as AnalysisDescriptor;
}

function textOrNull(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
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

export function registerFinancialAnalysisCorrectionRoutes(app: Express, database: DatabaseManager) {
  app.put("/api/financial-analysis/mappings", (request: Request, response: Response) => {
    const input = mappingBatchSchema.parse(request.body);
    ensureCompany(database, input.company_id);
    const stamp = new Date().toISOString();
    let updated = 0;
    let removed = 0;

    database.connection.transaction(() => {
      for (const mapping of input.mappings) {
        const account = ensureAccount(database, input.company_id, mapping.account_id);
        const before = database.connection.prepare("SELECT * FROM financial_account_mappings WHERE company_id=? AND account_id=?")
          .get(input.company_id, mapping.account_id) as Record<string, unknown> | undefined;

        if (mapping.statement_section === null) {
          if (before) {
            database.connection.prepare("DELETE FROM financial_account_mappings WHERE company_id=? AND account_id=?")
              .run(input.company_id, mapping.account_id);
            removed += 1;
            audit(
              database,
              "ELIMINAR",
              "financial_account_mappings",
              Number(before.id),
              input.company_id,
              `Clasificación financiera eliminada para ${String(account.code)}.`,
              before,
              undefined,
            );
          }
          continue;
        }

        if (mapping.statement_section !== "CURRENT_ASSET" && mapping.ratio_role && mapping.ratio_role !== "OTHER") {
          httpError("Los roles caja, cuentas por cobrar e inventario solo corresponden a activos corrientes.", 400);
        }

        database.connection.prepare(`INSERT INTO financial_account_mappings
          (company_id,account_id,statement_section,ratio_role,notes,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(company_id,account_id) DO UPDATE SET
          statement_section=excluded.statement_section,
          ratio_role=excluded.ratio_role,
          notes=excluded.notes,
          updated_at=excluded.updated_at`)
          .run(
            input.company_id,
            mapping.account_id,
            mapping.statement_section,
            mapping.ratio_role ?? null,
            textOrNull(mapping.notes),
            before?.created_at ?? stamp,
            stamp,
          );
        updated += 1;
        audit(
          database,
          before ? "EDITAR" : "CONFIGURAR",
          "financial_account_mappings",
          mapping.account_id,
          input.company_id,
          `Clasificación financiera guardada para ${String(account.code)}.`,
          before,
          mapping,
        );
      }
    })();

    response.json({
      updated,
      removed,
      message: `${updated} clasificaciones guardadas y ${removed} eliminadas.`,
    });
  });

  app.get("/api/financial-analysis/report", (request: Request, response: Response) => {
    response.json(buildCorrectedFinancialSnapshot(database, descriptorFromQuery(request)));
  });

  app.post("/api/financial-analysis/horizontal", (request: Request, response: Response) => {
    const input = horizontalSchema.parse(request.body);
    response.json(buildCorrectedHorizontalAnalysis(
      database,
      input.initial as AnalysisDescriptor,
      input.final as AnalysisDescriptor,
    ));
  });

  app.post("/api/financial-analysis/horizontal/export", async (request: Request, response: Response, next) => {
    try {
      const input = horizontalSchema.parse(request.body);
      const result = buildCorrectedHorizontalAnalysis(
        database,
        input.initial as AnalysisDescriptor,
        input.final as AnalysisDescriptor,
      );
      const workbook = buildHorizontalWorkbook(result);
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `analisis-horizontal-${result.initial.version_code}-${result.final.version_code}.xlsx`;
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      response.end(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  });
}
