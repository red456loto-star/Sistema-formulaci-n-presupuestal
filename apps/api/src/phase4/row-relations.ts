import { DatabaseManager } from "../../../../packages/database/src/index";
import { importTargets, TargetKey } from "./catalog-specs";
import { ValidatedRow } from "./import-types";

function exists(database: DatabaseManager, sql: string, ...params: unknown[]) {
  return Boolean(database.connection.prepare(sql).get(...params));
}

export function validateRelations(database: DatabaseManager, target: TargetKey, companyId: number | null, row: ValidatedRow) {
  const value = (key: string) => String(row.values[key] ?? "");
  if (importTargets[target].companyScoped && (!companyId || !exists(database, "SELECT id FROM companies WHERE id=? AND active=1", companyId))) row.errors.push("Seleccione una empresa activa para esta tabla.");
  if (target === "empresas" && !exists(database, "SELECT id FROM currencies WHERE code=? AND active=1", value("currency_code"))) row.errors.push("Moneda: el código no existe o está inactivo.");
  if (target === "centros" && companyId) {
    if (!exists(database, "SELECT id FROM sites WHERE company_id=? AND code=? AND active=1", companyId, value("site_code"))) row.errors.push("Código de sede: no existe en la empresa activa.");
    if (!exists(database, "SELECT id FROM responsibles WHERE company_id=? AND code=? AND active=1", companyId, value("responsible_code"))) row.errors.push("Código de responsable: no existe en la empresa activa.");
  }
  if (target === "elementos" && companyId && !exists(database, "SELECT id FROM budget_groups WHERE company_id=? AND code=? AND active=1", companyId, value("group_code"))) row.errors.push("Código de grupo: no existe en la empresa activa.");
  if (target === "cuentas" && companyId && !exists(database, "SELECT id FROM budget_elements WHERE company_id=? AND code=? AND active=1", companyId, value("element_code"))) row.errors.push("Código de elemento: no existe en la empresa activa.");
  if (target === "tipos-cambio" && !exists(database, "SELECT id FROM currencies WHERE code=? AND active=1", value("currency_code"))) row.errors.push("Código de moneda: no existe o está inactivo.");
}
