import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { buildReportPdf, buildReportWorkbook, reportFileName } from "../phase10/report-export";
import { buildPhase11Analysis } from "./analysis";
import { workflowStatus } from "./context";
import {
  deleteMasterDataset, deleteMasterRow, importMasterData, inspectMasterWorkbook, listMasterData,
  masterTemplate, updateMasterRow, type MasterDataImportInput,
} from "./master-data";
import { createPhase11Proposal, listPhase11Proposals, suggestPhase11Proposals, updatePhase11Proposal } from "./proposals";
import { buildPhase11Report } from "./reports";
import { seedBudgetTypes } from "./schema";

const positiveId = z.coerce.number().int().positive();
const nullableId = z.union([z.null(), positiveId]).optional();
const contextSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  period_id: positiveId,
  version_id: positiveId,
  budget_type_id: positiveId,
});
const optionalContextSchema = z.object({
  company_id: nullableId,
  exercise_id: nullableId,
  period_id: nullableId,
  version_id: nullableId,
  budget_type_id: nullableId,
});
const rowSchema = z.object({
  center_code: z.string().trim().max(80).optional().nullable(),
  center_name: z.string().trim().max(200).optional().nullable(),
  element_code: z.string().trim().max(80).optional().nullable(),
  element_name: z.string().trim().max(200).optional().nullable(),
  account_code: z.string().trim().max(80).optional().nullable(),
  account_name: z.string().trim().max(200).optional().nullable(),
  account_nature: z.enum(["INGRESO","COSTO","GASTO","ACTIVO","PASIVO","PATRIMONIO"]).optional().nullable(),
  line_code: z.string().trim().max(80).optional().nullable(),
  line_name: z.string().trim().min(1).max(240),
  statement_section: z.enum(["PRESUPUESTO","ESTADO_RESULTADOS","ESTADO_SITUACION","FLUJO_EFECTIVO"]).optional().nullable(),
  financial_item: z.string().trim().max(100).optional().nullable(),
  cost_behavior: z.enum(["FIJO","VARIABLE","NO_APLICA"]).optional().nullable(),
  cost_traceability: z.enum(["DIRECTO","INDIRECTO","NO_APLICA"]).optional().nullable(),
  quantity: z.coerce.number().finite().optional().nullable(),
  unit_price: z.coerce.number().finite().optional().nullable(),
  amount: z.coerce.number().finite(),
  source_reference: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
const importSchema = contextSchema.extend({
  data_kind: z.enum(["PRESUPUESTADO","REAL"]),
  source_file: z.string().trim().max(255).optional().nullable(),
  source_label: z.string().trim().max(255).optional().nullable(),
  source_url: z.string().trim().max(1000).optional().nullable(),
  source_period: z.string().trim().max(255).optional().nullable(),
  operator_name: z.string().trim().max(255).optional().nullable(),
  wacc_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  replace_existing: z.coerce.boolean().optional(),
  rows: z.array(rowSchema).min(1),
});
const proposalBase = {
  problem: z.string().trim().min(5).max(500), evidence_value: z.coerce.number().finite(), evidence_unit: z.string().trim().min(1).max(40),
  evidence_text: z.string().trim().min(10).max(1200), probable_cause: z.string().trim().min(5).max(1200),
  proposed_action: z.string().trim().min(5).max(1800), expected_impact: z.coerce.number().finite(),
  profitability_impact: z.union([z.null(), z.coerce.number().finite()]).optional(), responsible_id: positiveId,
  priority: z.enum(["ALTA","MEDIA","BAJA"]), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PROPUESTA","APROBADA","EN_EJECUCION","IMPLEMENTADA","DESCARTADA"]).optional(),
};
const proposalSchema = contextSchema.extend({ center_id: nullableId, element_id: nullableId, account_id: nullableId, ...proposalBase });
const proposalPatchSchema = z.object({
  problem: proposalBase.problem.optional(), evidence_value: proposalBase.evidence_value.optional(), evidence_unit: proposalBase.evidence_unit.optional(),
  evidence_text: proposalBase.evidence_text.optional(), probable_cause: proposalBase.probable_cause.optional(), proposed_action: proposalBase.proposed_action.optional(),
  expected_impact: proposalBase.expected_impact.optional(), profitability_impact: proposalBase.profitability_impact,
  responsible_id: proposalBase.responsible_id.optional(), priority: proposalBase.priority.optional(), due_date: proposalBase.due_date.optional(),
  status: z.enum(["PROPUESTA","APROBADA","EN_EJECUCION","IMPLEMENTADA","DESCARTADA"]).optional(),
});

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export function registerPhase11Routes(app: Express, database: DatabaseManager) {
  app.get("/api/phase11/budget-types", (request: Request, response: Response) => {
    const query = z.object({ company_id: positiveId }).parse(request.query);
    seedBudgetTypes(database, query.company_id);
    response.json(database.connection.prepare("SELECT * FROM budget_types WHERE company_id=? ORDER BY active DESC,sort_order,code").all(query.company_id));
  });

  app.post("/api/phase11/budget-types", (request: Request, response: Response) => {
    const input = z.object({ company_id: positiveId, code: z.string().trim().min(2).max(50), name: z.string().trim().min(3).max(180), category: z.enum(["OPERATIVO","COSTOS","FINANCIERO","ESTADO_FINANCIERO","OTRO"]), description: z.string().trim().max(500).optional().nullable(), sort_order: z.coerce.number().int().min(1).max(999).optional() }).parse(request.body);
    const company = database.connection.prepare("SELECT id FROM companies WHERE id=? AND active=1").get(input.company_id);
    if (!company) throw Object.assign(new Error("La empresa seleccionada no existe o está inactiva."), { statusCode: 400 });
    const stamp = new Date().toISOString();
    const id = Number(database.connection.prepare(`INSERT INTO budget_types (company_id,code,name,category,description,sort_order,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`)
      .run(input.company_id,input.code.toUpperCase(),input.name,input.category,input.description ?? null,input.sort_order ?? 100,stamp,stamp).lastInsertRowid);
    response.status(201).json(database.connection.prepare("SELECT * FROM budget_types WHERE id=?").get(id));
  });

  app.patch("/api/phase11/budget-types/:id", (request: Request, response: Response) => {
    const input = z.object({ name: z.string().trim().min(3).max(180).optional(), category: z.enum(["OPERATIVO","COSTOS","FINANCIERO","ESTADO_FINANCIERO","OTRO"]).optional(), description: z.string().trim().max(500).optional().nullable(), sort_order: z.coerce.number().int().min(1).max(999).optional(), active: z.coerce.boolean().optional() }).parse(request.body);
    const current = database.connection.prepare("SELECT * FROM budget_types WHERE id=?").get(Number(request.params.id)) as Record<string, unknown> | undefined;
    if (!current) throw Object.assign(new Error("El tipo de presupuesto no existe."), { statusCode: 404 });
    database.connection.prepare("UPDATE budget_types SET name=?,category=?,description=?,sort_order=?,active=?,updated_at=? WHERE id=?")
      .run(input.name ?? current.name,input.category ?? current.category,input.description === undefined ? current.description : input.description,input.sort_order ?? current.sort_order,input.active === undefined ? current.active : input.active ? 1 : 0,new Date().toISOString(),current.id);
    response.json(database.connection.prepare("SELECT * FROM budget_types WHERE id=?").get(current.id));
  });

  app.get("/api/phase11/workflow-status", (request: Request, response: Response) => {
    const query = optionalContextSchema.parse(request.query);
    response.json(workflowStatus(database, query));
  });

  app.get("/api/phase11/master-data", (request: Request, response: Response) => {
    response.json(listMasterData(database, contextSchema.parse(request.query)));
  });

  app.post("/api/phase11/master-data/inspect", async (request: Request, response: Response, next) => {
    try {
      const input = z.object({ file_name: z.string().trim().min(1), content_base64: z.string().min(10), sheet_name: z.string().trim().optional().nullable() }).parse(request.body);
      response.json(await inspectMasterWorkbook(input.file_name, input.content_base64, input.sheet_name));
    } catch (error) { next(error); }
  });

  app.get("/api/phase11/master-data/template", async (_request: Request, response: Response, next) => {
    try { response.json(await masterTemplate()); } catch (error) { next(error); }
  });

  app.post("/api/phase11/master-data/import", (request: Request, response: Response) => {
    response.status(201).json(importMasterData(database, importSchema.parse(request.body) as MasterDataImportInput));
  });

  app.patch("/api/phase11/master-data/rows/:id", (request: Request, response: Response) => {
    response.json(updateMasterRow(database, Number(request.params.id), rowSchema.partial().parse(request.body)));
  });

  app.delete("/api/phase11/master-data/rows/:id", (request: Request, response: Response) => {
    response.json(deleteMasterRow(database, Number(request.params.id)));
  });

  app.delete("/api/phase11/master-data/datasets/:id", (request: Request, response: Response) => {
    response.json(deleteMasterDataset(database, Number(request.params.id)));
  });

  app.get("/api/phase11/analysis", (request: Request, response: Response) => {
    response.json(buildPhase11Analysis(database, contextSchema.parse(request.query)));
  });

  app.post("/api/phase11/reports/:format", async (request: Request, response: Response, next) => {
    try {
      const input = contextSchema.extend({ kind: z.enum(["FINANCIAL","COSTS","VARIATIONS","DASHBOARD","PROPOSALS"]) }).parse(request.body);
      const format = z.enum(["excel","pdf"]).parse(request.params.format);
      const report = buildPhase11Report(database, input, input.kind);
      if (format === "excel") {
        const buffer = await buildReportWorkbook(report).xlsx.writeBuffer();
        response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", `attachment; filename="${reportFileName(report, "xlsx")}"`);
        response.end(Buffer.from(buffer));
      } else {
        const buffer = await buildReportPdf(report);
        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Disposition", `attachment; filename="${safeName(report.file_slug)}.pdf"`);
        response.end(buffer);
      }
    } catch (error) { next(error); }
  });

  app.get("/api/phase11/proposals", (request: Request, response: Response) => {
    response.json(listPhase11Proposals(database, contextSchema.parse(request.query)));
  });

  app.post("/api/phase11/proposals/suggestions", (request: Request, response: Response) => {
    response.json(suggestPhase11Proposals(database, contextSchema.parse(request.body)));
  });

  app.post("/api/phase11/proposals", (request: Request, response: Response) => {
    response.status(201).json(createPhase11Proposal(database, proposalSchema.parse(request.body)));
  });

  app.patch("/api/phase11/proposals/:id", (request: Request, response: Response) => {
    response.json(updatePhase11Proposal(database, Number(request.params.id), proposalPatchSchema.parse(request.body)));
  });
}
