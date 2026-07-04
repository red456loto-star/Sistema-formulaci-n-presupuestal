import { DatabaseManager } from "../../../../packages/database/src/index";
import { TargetKey } from "./catalog-specs";
import { ValidatedRow } from "./import-types";

function exists(database: DatabaseManager, sql: string, ...params: unknown[]) {
  return Boolean(database.connection.prepare(sql).get(...params));
}

export function duplicateExists(database: DatabaseManager, target: TargetKey, companyId: number | null, row: ValidatedRow) {
  const value = (key: string) => String(row.values[key] ?? "");
  if (target === "empresas") return exists(database, "SELECT id FROM companies WHERE code=? OR tax_id=?", value("code"), value("tax_id"));
  if (target === "sedes") return exists(database, "SELECT id FROM sites WHERE company_id=? AND code=?", companyId, value("code"));
  if (target === "responsables") return exists(database, "SELECT id FROM responsibles WHERE company_id=? AND (code=? OR email=?)", companyId, value("code"), value("email"));
  if (target === "centros") return exists(database, "SELECT id FROM activity_centers WHERE company_id=? AND code=?", companyId, value("code"));
  if (target === "grupos") return exists(database, "SELECT id FROM budget_groups WHERE company_id=? AND code=?", companyId, value("code"));
  if (target === "elementos") return exists(database, "SELECT id FROM budget_elements WHERE company_id=? AND code=?", companyId, value("code"));
  if (target === "cuentas") return exists(database, "SELECT id FROM budget_accounts WHERE company_id=? AND code=?", companyId, value("code"));
  if (target === "monedas") return exists(database, "SELECT id FROM currencies WHERE code=?", value("code"));
  if (target === "unidades") return exists(database, "SELECT id FROM units_of_measure WHERE code=?", value("code"));
  if (target === "tipos-cambio") return exists(database, "SELECT r.id FROM exchange_rates r JOIN currencies c ON c.id=r.currency_id WHERE c.code=? AND r.rate_date=?", value("currency_code"), value("rate_date"));
  return false;
}

export function fileKey(target: TargetKey, row: ValidatedRow) {
  const value = (key: string) => String(row.values[key] ?? "");
  if (target === "tipos-cambio") return `${value("currency_code")}|${value("rate_date")}`;
  if (target === "empresas") return `${value("code")}|${value("tax_id")}`;
  if (target === "responsables") return `${value("code")}|${value("email")}`;
  return value("code");
}
