import { DatabaseManager } from "../../../../packages/database/src/index";
import { audit } from "../phase2/common";
import { TargetKey } from "./catalog-specs";
import { ValidatedRow } from "./import-types";
import { writeMasterRow } from "./import-writer";

export interface ImportMetadata {
  company_id: number | null;
  target_table: TargetKey;
  file_name: string;
  sheet_name: string;
  operator_name?: string | null;
  source_company_name?: string | null;
  source_url?: string | null;
  source_period?: string | null;
  source_consulted_at?: string | null;
  transformations?: string | null;
  update_existing: boolean;
}

export function confirmImport(database: DatabaseManager, metadata: ImportMetadata, rows: ValidatedRow[]) {
  const stamp = new Date().toISOString();
  const summary = { read: rows.length, valid: 0, observed: 0, rejected: 0, excluded: 0, created: 0, updated: 0, skipped: 0 };

  const batchId = database.connection.transaction(() => {
    for (const row of rows) {
      if (row.excluded) summary.excluded += 1;
      else if (row.status === "RECHAZADO") summary.rejected += 1;
      else if (row.status === "OBSERVADO") summary.observed += 1;
      else summary.valid += 1;
    }
    const status = summary.rejected > 0 || summary.excluded > 0 ? "PARCIAL" : "IMPORTADO";
    const batch = database.connection.prepare(`INSERT INTO import_batches
      (company_id,target_table,file_name,sheet_name,operator_name,source_company_name,source_url,source_period,source_consulted_at,transformations,update_existing,status,rows_read,rows_valid,rows_observed,rows_rejected,rows_excluded,created_at,confirmed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(metadata.company_id, metadata.target_table, metadata.file_name, metadata.sheet_name, metadata.operator_name ?? null, metadata.source_company_name ?? null, metadata.source_url ?? null, metadata.source_period ?? null, metadata.source_consulted_at ?? null, metadata.transformations ?? null, metadata.update_existing ? 1 : 0, status, summary.read, summary.valid, summary.observed, summary.rejected, summary.excluded, stamp, stamp);
    const id = Number(batch.lastInsertRowid);
    const insertRow = database.connection.prepare(`INSERT INTO import_batch_rows
      (batch_id,row_number,validation_status,action_result,raw_data,normalized_data,errors,warnings,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`);

    for (const row of rows) {
      let action = row.excluded ? "EXCLUIDO" : row.status === "RECHAZADO" ? "RECHAZADO" : "OMITIDO";
      if (!row.excluded && row.status !== "RECHAZADO") {
        const result = writeMasterRow(database, metadata.target_table, metadata.company_id, row, metadata.update_existing);
        action = result.action;
        if (result.action === "CREADO") summary.created += 1;
        else if (result.action === "ACTUALIZADO") summary.updated += 1;
        else summary.skipped += 1;
      }
      insertRow.run(id, row.row_number, row.excluded ? "EXCLUIDO" : row.status, action, JSON.stringify(row.raw), JSON.stringify(row.values), JSON.stringify(row.errors), JSON.stringify(row.warnings), stamp);
    }

    database.connection.prepare("UPDATE import_batches SET rows_created=?,rows_updated=?,rows_skipped=? WHERE id=?")
      .run(summary.created, summary.updated, summary.skipped, id);

    if (metadata.source_company_name && metadata.source_url && metadata.source_consulted_at) {
      database.connection.prepare(`INSERT OR IGNORE INTO real_data_sources
        (company_name,source_url,source_period,consulted_at,verified_fields,transformations,notes,active,created_at)
        VALUES (?,?,?,?,?,?,?,1,?)`)
        .run(metadata.source_company_name, metadata.source_url, metadata.source_period ?? null, metadata.source_consulted_at, JSON.stringify(Object.keys(rows[0]?.values ?? {})), metadata.transformations ?? null, `Importación ${id}: ${metadata.target_table}`, stamp);
    }
    return id;
  })();

  audit(database, "IMPORTAR", "import_batches", batchId, metadata.company_id, `Importación ${metadata.target_table}: ${summary.created} creados, ${summary.updated} actualizados y ${summary.skipped} omitidos.`, undefined, summary);
  return { batch_id: batchId, ...summary, message: "Importación confirmada correctamente." };
}
