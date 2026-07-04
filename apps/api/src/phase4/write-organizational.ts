import { DatabaseManager } from "../../../../packages/database/src/index";
import { TargetKey } from "./catalog-specs";
import { WriteResult } from "./import-types";

const text = (values: Record<string, unknown>, key: string) => String(values[key] ?? "").trim();
const active = (values: Record<string, unknown>) => Number(values.active ?? 1) === 0 ? 0 : 1;
const rowId = (row: unknown) => row ? Number((row as { id: number }).id) : null;

function linkCenterAccounts(database: DatabaseManager, centerId: number, companyId: number) {
  database.connection.prepare("INSERT OR IGNORE INTO center_accounts (center_id, account_id, active, created_at) SELECT ?, id, 1, ? FROM budget_accounts WHERE company_id=? AND active=1")
    .run(centerId, new Date().toISOString(), companyId);
}

export function writeOrganizational(database: DatabaseManager, target: TargetKey, companyId: number | null, values: Record<string, unknown>, updateExisting: boolean): WriteResult | null {
  const db = database.connection;
  const stamp = new Date().toISOString();
  if (target === "empresas") {
    const currency = rowId(db.prepare("SELECT id FROM currencies WHERE code=?").get(text(values, "currency_code")));
    const existing = rowId(db.prepare("SELECT id FROM companies WHERE code=? OR tax_id=?").get(text(values, "code"), text(values, "tax_id")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE companies SET code=?,commercial_name=?,legal_name=?,tax_id=?,sector=?,currency_id=?,address=?,email=?,phone=?,active=?,updated_at=? WHERE id=?")
        .run(text(values, "code"), text(values, "commercial_name"), text(values, "legal_name"), text(values, "tax_id"), text(values, "sector"), currency, text(values, "address") || null, text(values, "email") || null, text(values, "phone") || null, active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO companies (code,commercial_name,legal_name,tax_id,sector,currency_id,address,email,phone,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(text(values, "code"), text(values, "commercial_name"), text(values, "legal_name"), text(values, "tax_id"), text(values, "sector"), currency, text(values, "address") || null, text(values, "email") || null, text(values, "phone") || null, active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }

  if (!companyId) return null;
  if (target === "sedes") {
    const existing = rowId(db.prepare("SELECT id FROM sites WHERE company_id=? AND code=?").get(companyId, text(values, "code")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE sites SET name=?,address=?,city=?,country=?,active=?,updated_at=? WHERE id=?")
        .run(text(values, "name"), text(values, "address") || null, text(values, "city") || null, text(values, "country") || "Perú", active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO sites (company_id,code,name,address,city,country,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(companyId, text(values, "code"), text(values, "name"), text(values, "address") || null, text(values, "city") || null, text(values, "country") || "Perú", active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }

  if (target === "responsables") {
    const existing = rowId(db.prepare("SELECT id FROM responsibles WHERE company_id=? AND (code=? OR email=?)").get(companyId, text(values, "code"), text(values, "email")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE responsibles SET code=?,full_name=?,position=?,email=?,phone=?,active=?,updated_at=? WHERE id=?")
        .run(text(values, "code"), text(values, "full_name"), text(values, "position"), text(values, "email"), text(values, "phone") || null, active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO responsibles (company_id,code,full_name,position,email,phone,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(companyId, text(values, "code"), text(values, "full_name"), text(values, "position"), text(values, "email"), text(values, "phone") || null, active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }

  if (target === "centros") {
    const siteId = rowId(db.prepare("SELECT id FROM sites WHERE company_id=? AND code=?").get(companyId, text(values, "site_code")));
    const responsibleId = rowId(db.prepare("SELECT id FROM responsibles WHERE company_id=? AND code=?").get(companyId, text(values, "responsible_code")));
    const existing = rowId(db.prepare("SELECT id FROM activity_centers WHERE company_id=? AND code=?").get(companyId, text(values, "code")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE activity_centers SET site_id=?,responsible_id=?,name=?,center_type=?,description=?,active=?,updated_at=? WHERE id=?")
        .run(siteId, responsibleId, text(values, "name"), text(values, "center_type"), text(values, "description") || null, active(values), stamp, existing);
      linkCenterAccounts(database, existing, companyId);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO activity_centers (company_id,site_id,responsible_id,code,name,center_type,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(companyId, siteId, responsibleId, text(values, "code"), text(values, "name"), text(values, "center_type"), text(values, "description") || null, active(values), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    linkCenterAccounts(database, id, companyId);
    return { action: "CREADO", id };
  }
  return null;
}
