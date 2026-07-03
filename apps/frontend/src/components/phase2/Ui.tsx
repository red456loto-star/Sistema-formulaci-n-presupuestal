import { isValidElement, useMemo, useState, type ReactNode } from "react";

export function Tabs({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return <div className="tabs">{items.map((item) => <button key={item} className={`tab ${active === item ? "tab--active" : ""}`} onClick={() => onChange(item)}>{item}</button>)}</div>;
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>;
}

export function Field({ label, children, span = 1 }: { label: string; children: ReactNode; span?: number }) {
  return <label className="field" style={{ gridColumn: `span ${span}` }}><span>{label}</span>{children}</label>;
}

function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

export function DataTable({ headers, rows, empty = "No hay registros." }: { headers: string[]; rows: ReactNode[][]; empty?: string }) {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return rows;
    return rows.filter((row) => row.some((cell) => nodeText(cell).toLocaleLowerCase("es").includes(normalized)));
  }, [query, rows]);

  return <div>
    <div style={{ maxWidth: 360, marginBottom: 14 }}>
      <label className="field"><span>Buscar en la tabla</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, nombre, estado..." /></label>
    </div>
    <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{filteredRows.length > 0 ? filteredRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="table-empty">{query ? "No hay coincidencias para la búsqueda." : empty}</td></tr>}</tbody></table></div>
  </div>;
}

export function Message({ type = "info", children }: { type?: "info" | "success" | "danger"; children: ReactNode }) {
  return <div className={`inline-message inline-message--${type}`}>{children}</div>;
}
