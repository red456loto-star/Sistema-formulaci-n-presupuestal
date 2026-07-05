import { useEffect, useState, type ReactNode } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { deleteRequest, patchJson, postJson } from "../../lib/api";
import { Field, FormGrid, Message } from "../../components/phase2/Ui";

export interface FieldOption { id: string | number; label: string; }

export interface MasterField {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  number?: boolean;
  nullable?: boolean;
  required?: boolean;
  span?: number;
  step?: string;
  options?: FieldOption[];
  placeholder?: string;
}

export interface MasterColumn<T> {
  label: string;
  render: (row: T) => ReactNode;
}

interface Props<T extends { id: number }> {
  title: string;
  description: string;
  endpoint: string;
  rows: T[];
  fields: MasterField[];
  columns: MasterColumn<T>[];
  initial: Record<string, string>;
  contextPayload: Record<string, number>;
  locked: boolean;
  busy?: boolean;
  empty?: string;
  onChanged: () => Promise<void>;
}

function emptyFrom(initial: Record<string, string>) {
  return { ...initial };
}

function rowToForm<T>(row: T, fields: MasterField[], initial: Record<string, string>) {
  const source = row as unknown as Record<string, unknown>;
  const result = { ...initial };
  for (const field of fields) {
    const value = source[field.key];
    result[field.key] = value === null || value === undefined ? "" : String(value);
  }
  return result;
}

function buildPayload(form: Record<string, string>, fields: MasterField[]) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = String(form[field.key] ?? "").trim();
    if (field.required && !raw) throw new Error(`Complete el campo ${field.label}.`);
    if (field.number) {
      if (!raw) {
        payload[field.key] = field.nullable ? null : 0;
      } else {
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error(`${field.label} debe ser numérico.`);
        payload[field.key] = value;
      }
    } else {
      payload[field.key] = raw || (field.nullable ? null : "");
    }
  }
  return payload;
}

export function MasterCrudSection<T extends { id: number }>({
  title,
  description,
  endpoint,
  rows,
  fields,
  columns,
  initial,
  contextPayload,
  locked,
  busy = false,
  empty = "No existen registros para el contexto seleccionado.",
  onChanged,
}: Props<T>) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => emptyFrom(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (selectedId === null) return;
    const selected = rows.find((row) => row.id === selectedId);
    if (!selected) {
      setSelectedId(null);
      setForm(emptyFrom(initial));
    }
  }, [rows, selectedId, initial]);

  const reset = () => {
    setSelectedId(null);
    setForm(emptyFrom(initial));
    setError("");
  };

  const select = (row: T) => {
    setSelectedId(row.id);
    setForm(rowToForm(row, fields, initial));
    setError("");
    setSuccess("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { ...contextPayload, ...buildPayload(form, fields) };
      const result = selectedId
        ? await patchJson<{ message: string }>(`${endpoint}/${selectedId}`, payload)
        : await postJson<{ message: string }>(endpoint, payload);
      setSuccess(result.message);
      await onChanged();
      if (!selectedId) setForm(emptyFrom(initial));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar el registro.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId || !window.confirm("¿Eliminar el registro seleccionado?")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await deleteRequest<{ message: string }>(`${endpoint}/${selectedId}`);
      setSuccess(result.message);
      reset();
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible eliminar el registro.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="panel master-component">
    <div className="panel__heading">
      <div><span className="eyebrow">Componente operativo</span><h2>{title}</h2><p>{description}</p></div>
      {!locked && <button className="button button--ghost" onClick={reset}><Plus size={16} />Nuevo</button>}
    </div>

    {error && <Message type="danger">{error}</Message>}
    {success && <Message type="success">{success}</Message>}

    {!locked && <div className="master-editor">
      <div className="master-editor__title">
        <strong>{selectedId ? `Editando registro #${selectedId}` : "Nuevo registro"}</strong>
        {selectedId && <button className="icon-button" onClick={reset} title="Cancelar edición"><X size={17} /></button>}
      </div>
      <FormGrid>
        {fields.map((field) => <Field key={field.key} label={field.label} span={field.span ?? 1}>
          {field.type === "select" ? <select
            value={form[field.key] ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
          >
            <option value="">Seleccione</option>
            {(field.options ?? []).map((option) => <option key={String(option.id)} value={option.id}>{option.label}</option>)}
          </select> : field.type === "textarea" ? <textarea
            value={form[field.key] ?? ""}
            placeholder={field.placeholder}
            onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
          /> : <input
            type={field.type === "number" ? "number" : "text"}
            step={field.step}
            value={form[field.key] ?? ""}
            placeholder={field.placeholder}
            onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
          />}
        </Field>)}
      </FormGrid>
      <div className="button-row">
        {selectedId && <button className="button button--ghost" disabled={saving || busy} onClick={() => void remove()}><Trash2 size={16} />Eliminar</button>}
        <button className="button button--primary" disabled={saving || busy} onClick={() => void save()}><Save size={16} />{selectedId ? "Actualizar" : "Guardar"}</button>
      </div>
    </div>}

    {locked && <Message>La versión está bloqueada. Los registros se muestran únicamente para consulta.</Message>}

    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}<th></th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => <tr key={row.id} className={row.id === selectedId ? "selected-row" : ""}>
            {columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}
            <td><button className="button button--ghost" onClick={() => select(row)}>{locked ? "Ver" : "Editar"}</button></td>
          </tr>) : <tr><td className="table-empty" colSpan={columns.length + 1}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
