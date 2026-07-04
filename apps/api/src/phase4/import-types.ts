import { ImportTarget } from "./catalog-specs";
import { ExtractedRow } from "./workbook-extract";

export type ValidationStatus = "VALIDO" | "OBSERVADO" | "RECHAZADO" | "EXCLUIDO";
export type WriteAction = "CREADO" | "ACTUALIZADO" | "OMITIDO";
export interface WriteResult { action: WriteAction; id?: number; }

export interface ValidatedRow {
  row_number: number;
  raw: Record<string, string>;
  values: Record<string, string | number | null>;
  status: ValidationStatus;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  excluded: boolean;
}

const codeFields = new Set(["code", "currency_code", "site_code", "responsible_code", "group_code", "element_code", "category", "center_type", "nature", "movement_type"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function activeValue(value: string): number | null {
  const normalized = value.trim().toLocaleLowerCase("es");
  if (!normalized) return 1;
  if (["1", "si", "sí", "activo", "true", "verdadero"].includes(normalized)) return 1;
  if (["0", "no", "inactivo", "false", "falso"].includes(normalized)) return 0;
  return null;
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!datePattern.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

export function normalizeExtractedRow(target: ImportTarget, row: ExtractedRow): ValidatedRow {
  const values: Record<string, string | number | null> = {};
  const errors: string[] = [];
  for (const field of target.fields) {
    const original = String(row.values[field.key] ?? "").trim();
    if (field.required && !original) errors.push(`${field.label}: campo obligatorio.`);
    if (field.key === "active") {
      const active = activeValue(original);
      if (active === null) errors.push(`${field.label}: use Activo/Inactivo, Sí/No o 1/0.`);
      values[field.key] = active ?? original;
    } else if (["decimals", "buy_rate", "sell_rate"].includes(field.key)) {
      const number = original === "" ? null : Number(original.replace(",", "."));
      if (original && (!Number.isFinite(number) || number! < 0)) errors.push(`${field.label}: debe ser numérico y no negativo.`);
      values[field.key] = number;
    } else if (field.key === "rate_date") {
      const date = original ? normalizeDate(original) : null;
      if (original && !date) errors.push(`${field.label}: use el formato AAAA-MM-DD.`);
      values[field.key] = date;
    } else {
      values[field.key] = codeFields.has(field.key) ? original.toUpperCase() : original;
    }
  }

  const email = String(values.email ?? "");
  if (email && !emailPattern.test(email)) errors.push("Correo: formato inválido.");
  const decimals = values.decimals;
  if (typeof decimals === "number" && (!Number.isInteger(decimals) || decimals < 0 || decimals > 6)) errors.push("Decimales: debe ser un entero entre 0 y 6.");
  if (target.key === "centros" && !["PRODUCTIVO", "APOYO", "COMERCIAL", "ADMINISTRATIVO"].includes(String(values.center_type))) errors.push("Tipo: valor permitido PRODUCTIVO, APOYO, COMERCIAL o ADMINISTRATIVO.");
  if (target.key === "cuentas" && !["INGRESO", "COSTO", "GASTO", "ACTIVO", "PASIVO", "PATRIMONIO"].includes(String(values.nature))) errors.push("Naturaleza: valor no permitido.");
  if (target.key === "cuentas" && values.movement_type && !["DETALLE", "ACUMULADORA"].includes(String(values.movement_type))) errors.push("Tipo de movimiento: use DETALLE o ACUMULADORA.");
  return { row_number: row.row_number, raw: row.raw, values, status: errors.length ? "RECHAZADO" : "VALIDO", errors, warnings: [], duplicate: false, excluded: false };
}
