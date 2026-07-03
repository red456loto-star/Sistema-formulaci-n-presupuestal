import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { DatabaseManager, type SessionIdentity } from "../../../../packages/database/src/index";
import type { ApiErrorResponse } from "../../../../packages/shared/src/index";

export interface AuthenticatedRequest extends Request {
  identity?: SessionIdentity;
  authToken?: string;
}

export interface CatalogConfig {
  table: string;
  module: "EMPRESAS" | "ESTRUCTURA" | "PARAMETROS";
  companyScoped: boolean;
  fields: Record<string, z.ZodTypeAny>;
  orderBy: string;
  foreignScopes?: Array<{ field: string; table: string }>;
}

export const text = (min = 1, max = 160) => z.string().trim().min(min).max(max);
export const nullableText = (max = 300) => z.string().trim().max(max).optional().nullable();
export const activeField = z.union([z.boolean(), z.number().int().min(0).max(1)]).optional();
export const emailField = z.string().trim().email().max(160);
export const positiveId = z.coerce.number().int().positive();

export function normalizeActive(value: unknown) {
  return typeof value === "boolean" ? (value ? 1 : 0) : value;
}

export function isAdmin(identity: SessionIdentity) {
  return identity.roles.includes("ADMINISTRADOR");
}

export function hasPermission(identity: SessionIdentity, permission: string) {
  return isAdmin(identity) || identity.permissions.includes(permission);
}

export function requirePermission(permission: string) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.identity || !hasPermission(request.identity, permission)) {
      response.status(403).json({ code: "FORBIDDEN", message: "No cuenta con permiso para realizar esta acción." } satisfies ApiErrorResponse);
      return;
    }
    next();
  };
}

export function authenticate(database: DatabaseManager) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const identity = token ? database.getIdentityByToken(token) : null;
    if (!identity) {
      response.status(401).json({ code: "UNAUTHORIZED", message: "Debe iniciar sesión para continuar." } satisfies ApiErrorResponse);
      return;
    }
    request.identity = identity;
    request.authToken = token;
    next();
  };
}

export function validateCompanyAccess(identity: SessionIdentity, companyId: number) {
  if (!isAdmin(identity) && identity.companyId !== companyId) {
    const error = new Error("No puede acceder a información de otra empresa.");
    Object.assign(error, { statusCode: 403 });
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

export function audit(database: DatabaseManager, identity: SessionIdentity, action: string, entity: string, entityId: number | null, companyId: number | null, description: string, before?: unknown, after?: unknown) {
  database.connection.prepare(`INSERT INTO audit_events
    (user_id, company_id, action, entity, entity_id, description, before_data, after_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(identity.id, companyId, action, entity, entityId, description, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, new Date().toISOString());
}
