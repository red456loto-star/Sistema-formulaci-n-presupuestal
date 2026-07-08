import { API_BASE_URL } from "../../lib/api";
import type { ReportValueType } from "./types";

export function formatReportValue(value: unknown, type: ReportValueType, currency = "PEN") {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (type === "money" && Number.isFinite(number)) {
    try { return new Intl.NumberFormat("es-PE", { style: "currency", currency, maximumFractionDigits: 2 }).format(number); }
    catch { return `${currency} ${number.toFixed(2)}`; }
  }
  if (type === "percent" && Number.isFinite(number)) return `${number.toFixed(2)} %`;
  if (type === "number" && Number.isFinite(number)) return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 4 }).format(number);
  if (type === "date") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("es-PE").format(date);
  }
  return String(value).replaceAll("_", " ");
}

function filenameFromHeader(header: string | null, fallback: string) {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export async function downloadPhase10(route: string, body: unknown, fallbackName: string) {
  const response = await fetch(`${API_BASE_URL}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? "No fue posible generar el archivo.");
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromHeader(response.headers.get("content-disposition"), fallbackName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadPhase10Get(route: string, fallbackName: string) {
  const response = await fetch(`${API_BASE_URL}${route}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? "No fue posible descargar el archivo.");
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromHeader(response.headers.get("content-disposition"), fallbackName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
