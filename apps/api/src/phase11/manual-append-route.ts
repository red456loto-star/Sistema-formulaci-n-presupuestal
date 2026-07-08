import type { Express, Request, Response } from "express";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { importMasterData, type MasterDataImportInput, type MasterDataRowInput } from "./master-data";

export function registerPhase11ManualAppendRoute(app: Express, database: DatabaseManager) {
  app.post("/api/phase11/master-data/import", (request: Request, response: Response, next) => {
    const input = request.body as Partial<MasterDataImportInput>;
    const isManualAppend = !input.source_file && input.replace_existing !== true && Array.isArray(input.rows) && input.rows.length === 1;
    if (!isManualAppend || !input.company_id || !input.exercise_id || !input.period_id || !input.version_id || !input.budget_type_id || !input.data_kind) {
      next();
      return;
    }
    const dataset = database.connection.prepare(`SELECT id FROM master_data_sets
      WHERE company_id=? AND exercise_id=? AND period_id=? AND version_id=? AND budget_type_id=? AND data_kind=?`)
      .get(input.company_id, input.exercise_id, input.period_id, input.version_id, input.budget_type_id, input.data_kind) as { id: number } | undefined;
    if (!dataset) {
      next();
      return;
    }
    const current = database.connection.prepare(`SELECT center_code,center_name,element_code,element_name,account_code,account_name,
      account_nature,line_code,line_name,statement_section,financial_item,cost_behavior,cost_traceability,quantity,unit_price,amount,
      source_reference,notes FROM master_data_rows WHERE dataset_id=? ORDER BY row_order,id`).all(dataset.id) as MasterDataRowInput[];
    const result = importMasterData(database, {
      ...(input as MasterDataImportInput),
      replace_existing: true,
      rows: [...current, ...(input.rows as MasterDataRowInput[])],
    });
    response.status(201).json({ ...result, message: "Partida agregada al registro maestro existente." });
  });
}
