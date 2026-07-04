import { DatabaseManager } from "../../../../packages/database/src/index";
import { TargetKey } from "./catalog-specs";
import { WriteResult } from "./import-types";

const text = (values: Record<string, unknown>, key: string) => String(values[key] ?? "").trim();
const numeric = (values: Record<string, unknown>, key: string) => Number(values[key]);
const active = (values: Record<string, unknown>) => Number(values.active ?? 1) === 0 ? 0 : 1;
const idOf = (row: unknown) => row ? Number((row as { id: number }).id) : null;

export function writeParameters(database: DatabaseManager, target: TargetKey, values: Record<string, unknown>, updateExisting: boolean): WriteResult | null {
  const db = database.connection;
  const stamp = new Date().toISOString();
  if (target === "monedas") {
    const existing = idOf(db.prepare("SELECT id FROM currencies WHERE code=?").get(text(values, "code")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE currencies SET name=?,symbol=?,decimals=?,active=?,updated_at=? WHERE id=?").run(text(values, "name"), text(values, "symbol"), numeric(values, "decimals"), active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO currencies (code,name,symbol,decimals,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(text(values, "code"), text(values, "name"), text(values, "symbol"), numeric(values, "decimals"), active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }
  if (target === "unidades") {
    const existing = idOf(db.prepare("SELECT id FROM units_of_measure WHERE code=?").get(text(values, "code")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE units_of_measure SET name=?,category=?,active=?,updated_at=? WHERE id=?").run(text(values, "name"), text(values, "category"), active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO units_of_measure (code,name,category,active,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(text(values, "code"), text(values, "name"), text(values, "category"), active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }
  if (target === "tipos-cambio") {
    const currencyId = idOf(db.prepare("SELECT id FROM currencies WHERE code=?").get(text(values, "currency_code")));
    const existing = idOf(db.prepare("SELECT id FROM exchange_rates WHERE currency_id=? AND rate_date=?").get(currencyId, text(values, "rate_date")));
    if (existing && !updateExisting) return { action: "OMITIDO", id: existing };
    if (existing) {
      db.prepare("UPDATE exchange_rates SET buy_rate=?,sell_rate=?,source=?,active=?,updated_at=? WHERE id=?").run(numeric(values, "buy_rate"), numeric(values, "sell_rate"), text(values, "source") || null, active(values), stamp, existing);
      return { action: "ACTUALIZADO", id: existing };
    }
    const result = db.prepare("INSERT INTO exchange_rates (currency_id,rate_date,buy_rate,sell_rate,source,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(currencyId, text(values, "rate_date"), numeric(values, "buy_rate"), numeric(values, "sell_rate"), text(values, "source") || null, active(values), stamp, stamp);
    return { action: "CREADO", id: Number(result.lastInsertRowid) };
  }
  return null;
}
