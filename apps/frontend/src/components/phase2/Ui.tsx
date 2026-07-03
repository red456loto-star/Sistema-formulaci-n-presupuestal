import type { ReactNode } from "react";

export function Tabs({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return <div className="tabs">{items.map((item) => <button key={item} className={`tab ${active === item ? "tab--active" : ""}`} onClick={() => onChange(item)}>{item}</button>)}</div>;
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>;
}

export function Field({ label, children, span = 1 }: { label: string; children: ReactNode; span?: number }) {
  return <label className="field" style={{ gridColumn: `span ${span}` }}><span>{label}</span>{children}</label>;
}

export function DataTable({ headers, rows, empty = "No hay registros." }: { headers: string[]; rows: ReactNode[][]; empty?: string }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length > 0 ? rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="table-empty">{empty}</td></tr>}</tbody></table></div>;
}

export function Message({ type = "info", children }: { type?: "info" | "success" | "danger"; children: ReactNode }) {
  return <div className={`inline-message inline-message--${type}`}>{children}</div>;
}
