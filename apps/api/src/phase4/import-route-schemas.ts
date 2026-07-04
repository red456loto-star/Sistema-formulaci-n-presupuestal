import { z } from "zod";
import { importTargets } from "./catalog-specs";

const targetKeys = Object.keys(importTargets) as [keyof typeof importTargets, ...(keyof typeof importTargets)[]];
export const targetSchema = z.enum(targetKeys);
export const fileSchema = z.object({
  file_name: z.string().trim().min(1).max(255).refine((value) => value.toLocaleLowerCase().endsWith(".xlsx"), "Solo se admiten archivos .xlsx."),
  content_base64: z.string().min(1),
});
export const analyzeSchema = fileSchema.extend({
  company_id: z.coerce.number().int().positive().optional().nullable(),
  target_table: targetSchema,
  sheet_name: z.string().trim().min(1),
  header_row: z.coerce.number().int().positive(),
  mapping: z.record(z.string(), z.string()),
});
export const editableRowSchema = z.object({
  row_number: z.coerce.number().int().positive(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  excluded: z.boolean().optional().default(false),
});
export const confirmSchema = z.object({
  company_id: z.coerce.number().int().positive().optional().nullable(),
  target_table: targetSchema,
  file_name: z.string().trim().min(1).max(255),
  sheet_name: z.string().trim().min(1),
  operator_name: z.string().trim().max(160).optional().nullable(),
  source_company_name: z.string().trim().max(200).optional().nullable(),
  source_url: z.string().trim().url().optional().nullable(),
  source_period: z.string().trim().max(120).optional().nullable(),
  source_consulted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  transformations: z.string().trim().max(1000).optional().nullable(),
  update_existing: z.boolean().default(false),
  rows: z.array(editableRowSchema).min(1).max(5000),
});
