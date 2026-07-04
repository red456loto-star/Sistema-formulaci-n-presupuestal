
import type { Request } from "express";
import { z } from "zod";
import { DatabaseManager } from "../../../../packages/database/src/index";

export type LocalRequest = Request;

export interface CatalogConfig {
  table: string;
  module: "EMPRESAS" | "ESTRUCTURA" | "PARAMETROS";
  companyScoped: boolean;
  fields: Record<string, z.ZodTypeAny>;
  orderBy: string;
  foreignScopes?: Array<{ field: string; table: string }>;
}

export const text = (min = 1, max = 160) => z.string().trim().min(min).max(max);
export const codeField = (min = 1, max = 40) => text(min, max).transform((value) => value.toUpperCase());
export const nullableText = (max = 300) => z.string().trim().max(max).optional().nullable();
export const activeField = z.union([z.boolean(), z.number().int().min(0).max(1)]).optional();
export const emailField = z.string().trim().email().max(160);
export const positiveId = z.coerce.number().int().positive();

export function normalizeActive(value: unknown) {
  return typeof value === "boolean" ? (value ? 1 : 0) : value;
}

export function requireCompanyId(value: unknown) {
  const companyId = Number(value);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    const error = new Error("Seleccione una empresa para continuar.");
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
  return companyId;
}

export function ensureCompanyExists(database: DatabaseManager, companyId: number, activeOnly = false) {
  const condition = activeOnly ? " AND active = 1" : "";
  const company = database.connection.prepare(`SELECT id FROM companies WHERE id = ?${condition}`).get(companyId);
  if (!company) {
    const error = new Error(activeOnly ? "La empresa seleccionada no existe o se encuentra inactiva." : "La empresa seleccionada no existe.");
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
}

export function ensureForeignScopes(database: DatabaseManager, config: CatalogConfig, payload: Record<string, unknown>, companyId: number) {
  for (const relation of config.foreignScopes ?? []) {
    const relationId = payload[relation.field];
    if (relationId === null || relationId === undefined) continue;
    const found = database.connection.prepare(`SELECT id FROM ${relation.table} WHERE id = ? AND company_id = ?`).get(relationId, companyId);
    if (!found) {
      const error = new Error(`El valor seleccionado en ${relation.field} no pertenece a la empresa activa.`);
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
  }
}

export function audit(
  database: DatabaseManager,
  action: string,
  entity: string,
  entityId: number | null,
  companyId: number | null,
  description: string,
  before?: unknown,
  after?: unknown,
) {
  database.connection.prepare(`INSERT INTO audit_events
    (company_id, action, entity, entity_id, description, before_data, after_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(companyId, action, entity, entityId, description, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, new Date().toISOString());
}
