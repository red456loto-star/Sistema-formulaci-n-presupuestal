import { DatabaseManager } from "../../../../packages/database/src/index";
import { TargetKey } from "./catalog-specs";
import { WriteResult } from "./import-types";

const text = (values: Record<string, unknown>, key: string) => String(values[key] ?? "").trim();
const active = (values: Record<string, unknown>) => Number(values.active ?? 1) === 0 ? 0 : 1;
const rowId = (row: unknown) => row ? Number((row as { id: number }).id) : null;

function linkAccountCenters(database: DatabaseManager, accountId: number, companyId: number) {
  database.connection.prepare("INSERT OR IGNORE INTO center_accounts (center_id, account_id, active, created_at) SELECT id, ?, 1, ? FROM activity_centers WHERE company_id=? AND active=1")
    .run(accountId, new Date().toISOString(), companyId);
}

export function writeBudget(database: DatabaseManager, target: TargetKey, companyId: number | null, values: Record<string, unknown>, updateExisting: boolean): WriteResult | null {
  if (!companyId) return null;
  const db = database.connection;
  const stamp = new Date().toISOString();

  if (target === "grupos") {
    const existing = rowId(db.prepare("SELECT id FROM budget_groups WHERE company_id=? AND code=?").get(companyId, text(values, "code")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE budget_groups SET name=?,description=?,active=?,updated_at=? WHERE id=?")
        .run(text(values, "name"), text(values, "description") || null, active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO budget_groups (company_id,code,name,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(companyId, text(values, "code"), text(values, "name"), text(values, "description") || null, active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }

  if (target === "elementos") {
    const groupId = rowId(db.prepare("SELECT id FROM budget_groups WHERE company_id=? AND code=?").get(companyId, text(values, "group_code")));
    const existing = rowId(db.prepare("SELECT id FROM budget_elements WHERE company_id=? AND code=?").get(companyId, text(values, "code")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE budget_elements SET group_id=?,name=?,description=?,active=?,updated_at=? WHERE id=?")
        .run(groupId, text(values, "name"), text(values, "description") || null, active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO budget_elements (company_id,group_id,code,name,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(companyId, groupId, text(values, "code"), text(values, "name"), text(values, "description") || null, active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }

  if (target === "cuentas") {
    const elementId = rowId(db.prepare("SELECT id FROM budget_elements WHERE company_id=? AND code=?").get(companyId, text(values, "element_code")));
    const existing = rowId(db.prepare("SELECT id FROM budget_accounts WHERE company_id=? AND code=?").get(companyId, text(values, "code")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE budget_accounts SET element_id=?,name=?,nature=?,movement_type=?,description=?,active=?,updated_at=? WHERE id=?")
        .run(elementId, text(values, "name"), text(values, "nature"), text(values, "movement_type") || "DETALLE", text(values, "description") || null, active(values), stamp, existing);
      linkAccountCenters(database, existing, companyId);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO budget_accounts (company_id,element_id,code,name,nature,movement_type,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(companyId, elementId, text(values, "code"), text(values, "name"), text(values, "nature"), text(values, "movement_type") || "DETALLE", text(values, "description") || null, active(values), stamp, stamp);
    const id = Number(result.lastInsertRowid);
    linkAccountCenters(database, id, companyId);
    return { action: "CREADO", id };
  }
  return null;
}
