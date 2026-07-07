import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { buildPhase9Analysis, buildPhase9Workbook, getPhase9Options, type Phase9Input } from "./calculations";

const positiveId = z.coerce.number().int().positive();
const nullableId = z.union([z.null(), positiveId]).optional();
const inputSchema = z.object({
  company_id: positiveId,
  exercise_id: positiveId,
  original_version_id: positiveId,
  forecast_version_id: nullableId,
  period_number: z.union([z.null(), z.coerce.number().int().min(1).max(12)]).optional(),
  center_id: nullableId,
  group_id: nullableId,
  element_id: nullableId,
  account_id: nullableId,
  budget_type: z.union([z.null(), z.string().trim().min(2).max(80)]).optional(),
  comparison: z.enum(["ORIGINAL_REAL", "ORIGINAL_FORECAST", "FORECAST_REAL"]),
  materiality_threshold: z.coerce.number().finite().min(0.1).max(100).optional().default(10),
});

export function registerPhase9Routes(app: Express, database: DatabaseManager) {
  app.get("/api/phase9/options", (request: Request, response: Response) => {
    const query = z.object({ company_id: positiveId, exercise_id: positiveId }).parse(request.query);
    response.json(getPhase9Options(database, query.company_id, query.exercise_id));
  });

  app.post("/api/phase9/analyze", (request: Request, response: Response) => {
    const input = inputSchema.parse(request.body) as Phase9Input;
    response.json(buildPhase9Analysis(database, input));
  });

  app.post("/api/phase9/export", async (request: Request, response: Response, next) => {
    try {
      const input = inputSchema.parse(request.body) as Phase9Input;
      const result = buildPhase9Analysis(database, input);
      const workbook = buildPhase9Workbook(result);
      const buffer = await workbook.xlsx.writeBuffer();
      const comparison = input.comparison.toLowerCase().replaceAll("_", "-");
      const fileName = `variaciones-dashboard-${result.context.original_version_code}-${comparison}.xlsx`;
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      response.end(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  });
}
