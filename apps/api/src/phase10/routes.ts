import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { getReportOptions, type ReportInput } from "./report-model";
import { buildReport } from "./report-service";
import { buildReportPdf, buildReportWorkbook, reportFileName } from "./report-export";
import { createAndSendBudget, getDeliveryAttachment, getSmtpSettings, listDeliveries, retryBudgetDelivery, saveSmtpSettings, type SmtpSettingsInput } from "./mail";
import { createProposal, listProposals, suggestProposals, updateProposal } from "./proposals";

const positiveId = z.coerce.number().int().positive();
const nullableId = z.union([z.null(), positiveId]).optional();
const periodNumber = z.union([z.null(), z.coerce.number().int().min(1).max(12)]).optional();
const reportType = z.enum(["ORIGINAL", "FORECAST", "MASTER", "FINANCIAL", "VARIANCES", "CENTERS", "EXECUTIVE", "DASHBOARD", "PROPOSALS"]);

const reportSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  version_id: positiveId,
  report_type: reportType,
  period_number: periodNumber,
  center_id: nullableId,
  responsible_id: nullableId,
});

const smtpSchema = z.object({
  host: z.string().trim().min(2).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.coerce.boolean(),
  username: z.string().trim().max(255).optional().nullable(),
  password: z.string().max(500).optional().nullable(),
  from_name: z.string().trim().min(2).max(160),
  from_email: z.string().trim().email().max(255),
});

const proposalSource = z.enum(["ORIGINAL", "FORECAST", "VARIACION", "COSTOS", "DASHBOARD"]);
const proposalPriority = z.enum(["ALTA", "MEDIA", "BAJA"]);
const proposalStatus = z.enum(["PROPUESTA", "APROBADA", "EN_EJECUCION", "IMPLEMENTADA", "DESCARTADA"]);
const proposalFields = {
  problem: z.string().trim().min(5).max(500),
  evidence_value: z.coerce.number().finite(),
  evidence_unit: z.string().trim().min(1).max(40),
  evidence_text: z.string().trim().min(10).max(1000),
  probable_cause: z.string().trim().min(5).max(1000),
  proposed_action: z.string().trim().min(5).max(1500),
  expected_impact: z.coerce.number().finite(),
  profitability_impact: z.union([z.null(), z.coerce.number().finite()]).optional(),
  responsible_id: positiveId,
  priority: proposalPriority,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: proposalStatus.optional(),
};
const proposalCreateSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  period_id: nullableId,
  version_id: positiveId,
  center_id: nullableId,
  element_id: nullableId,
  account_id: nullableId,
  source_type: proposalSource,
  ...proposalFields,
});
const proposalPatchSchema = z.object({
  problem: proposalFields.problem.optional(),
  evidence_value: proposalFields.evidence_value.optional(),
  evidence_unit: proposalFields.evidence_unit.optional(),
  evidence_text: proposalFields.evidence_text.optional(),
  probable_cause: proposalFields.probable_cause.optional(),
  proposed_action: proposalFields.proposed_action.optional(),
  expected_impact: proposalFields.expected_impact.optional(),
  profitability_impact: proposalFields.profitability_impact,
  responsible_id: proposalFields.responsible_id.optional(),
  priority: proposalFields.priority.optional(),
  due_date: proposalFields.due_date.optional(),
  status: proposalStatus.optional(),
});

export function registerPhase10Routes(app: Express, database: DatabaseManager) {
  app.get("/api/phase10/options", (request: Request, response: Response) => {
    const query = z.object({ company_id: positiveId, exercise_id: positiveId }).parse(request.query);
    response.json(getReportOptions(database, query.company_id, query.exercise_id));
  });

  app.post("/api/phase10/reports/preview", (request: Request, response: Response) => {
    const input = reportSchema.parse(request.body) as ReportInput;
    response.json(buildReport(database, input));
  });

  app.post("/api/phase10/reports/excel", async (request: Request, response: Response, next) => {
    try {
      const input = reportSchema.parse(request.body) as ReportInput;
      const report = buildReport(database, input);
      const workbook = buildReportWorkbook(report);
      const buffer = await workbook.xlsx.writeBuffer();
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename="${reportFileName(report, "xlsx")}"`);
      response.end(Buffer.from(buffer));
    } catch (error) { next(error); }
  });

  app.post("/api/phase10/reports/pdf", async (request: Request, response: Response, next) => {
    try {
      const input = reportSchema.parse(request.body) as ReportInput;
      const report = buildReport(database, input);
      const buffer = await buildReportPdf(report);
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `attachment; filename="${reportFileName(report, "pdf")}"`);
      response.end(buffer);
    } catch (error) { next(error); }
  });

  app.get("/api/phase10/smtp-settings", (request: Request, response: Response) => {
    const query = z.object({ company_id: positiveId }).parse(request.query);
    response.json(getSmtpSettings(database, query.company_id));
  });

  app.put("/api/phase10/smtp-settings", (request: Request, response: Response) => {
    const input = z.object({ company_id: positiveId, smtp: smtpSchema.omit({ password: true }) }).parse(request.body);
    response.json({ settings: saveSmtpSettings(database, input.company_id, input.smtp), message: "Configuración SMTP guardada sin almacenar la contraseña." });
  });

  app.get("/api/phase10/email-history", (request: Request, response: Response) => {
    const query = z.object({ company_id: positiveId, exercise_id: positiveId }).parse(request.query);
    response.json(listDeliveries(database, query.company_id, query.exercise_id));
  });

  app.post("/api/phase10/email/send", async (request: Request, response: Response, next) => {
    try {
      const input = z.object({
        company_id: positiveId, exercise_id: positiveId, version_id: positiveId, center_id: positiveId,
        period_number: periodNumber, smtp: smtpSchema,
      }).parse(request.body);
      const result = await createAndSendBudget(database, { ...input, smtp: input.smtp as SmtpSettingsInput });
      response.status(201).json(result);
    } catch (error) { next(error); }
  });

  app.post("/api/phase10/email/:id/retry", async (request: Request, response: Response, next) => {
    try {
      const input = z.object({ smtp: smtpSchema }).parse(request.body);
      response.json(await retryBudgetDelivery(database, Number(request.params.id), input.smtp as SmtpSettingsInput));
    } catch (error) { next(error); }
  });

  app.get("/api/phase10/email/:id/attachment", (request: Request, response: Response) => {
    const result = getDeliveryAttachment(database, Number(request.params.id));
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${result.delivery.attachment_name}"`);
    response.end(result.buffer);
  });

  app.get("/api/phase10/proposals", (request: Request, response: Response) => {
    const query = z.object({ company_id: positiveId, exercise_id: positiveId, version_id: nullableId }).parse(request.query);
    response.json(listProposals(database, query.company_id, query.exercise_id, query.version_id ?? null));
  });

  app.post("/api/phase10/proposals", (request: Request, response: Response) => {
    response.status(201).json(createProposal(database, proposalCreateSchema.parse(request.body)));
  });

  app.patch("/api/phase10/proposals/:id", (request: Request, response: Response) => {
    response.json(updateProposal(database, Number(request.params.id), proposalPatchSchema.parse(request.body)));
  });

  app.post("/api/phase10/proposals/suggestions", (request: Request, response: Response) => {
    const input = z.object({
      company_id: positiveId, exercise_id: positiveId, version_id: positiveId,
      period_number: periodNumber, center_id: nullableId,
    }).parse(request.body);
    response.json(suggestProposals(database, input.company_id, input.exercise_id, input.version_id, input.period_number ?? null, input.center_id ?? null));
  });
}
