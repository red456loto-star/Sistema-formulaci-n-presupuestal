import type { ImportField, ImportRow } from "./types";

export function ImportRowsTable({ fields, rows, onChange, onExclude }: {
  fields: ImportField[];
  rows: ImportRow[];
  onChange: (rowIndex: number, key: string, value: string) => void;
  onExclude: (rowIndex: number, excluded: boolean) => void;
}) {
  if (!rows.length) return <p className="muted">No hay filas analizadas.</p>;
  return <div className="import-table-wrap">
    <table className="data-table import-data-table">
      <thead><tr><th>Usar</th><th>Fila</th><th>Estado</th>{fields.map((field) => <th key={field.key}>{field.label}{field.required ? " *" : ""}</th>)}<th>Observaciones</th></tr></thead>
      <tbody>{rows.map((row, rowIndex) => <tr key={row.row_number} className={row.excluded ? "row-excluded" : ""}>
        <td><input type="checkbox" checked={!row.excluded} onChange={(event) => onExclude(rowIndex, !event.target.checked)} aria-label={`Incluir fila ${row.row_number}`} /></td>
        <td>{row.row_number}</td>
        <td><span className={`status-pill status-pill--${row.status === "RECHAZADO" ? "danger" : row.status === "OBSERVADO" ? "warning" : "success"}`}>{row.excluded ? "EXCLUIDO" : row.status}</span></td>
        {fields.map((field) => <td key={field.key}><input value={String(row.values[field.key] ?? "")} disabled={row.excluded} onChange={(event) => onChange(rowIndex, field.key, event.target.value)} /></td>)}
        <td><div className="cell-notes">{row.errors.map((error) => <span className="text-danger" key={error}>{error}</span>)}{row.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
