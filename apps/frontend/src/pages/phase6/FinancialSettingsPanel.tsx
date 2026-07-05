import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { Field, FormGrid, Message } from "../../components/phase2/Ui";
import type { FinancialSettings } from "./types";

function toForm(settings: FinancialSettings) {
  return {
    tax_rate: String(settings.tax_rate),
    collection_rate: String(settings.collection_rate),
    payment_rate: String(settings.payment_rate),
    opening_cash: String(settings.opening_cash),
    opening_receivables: String(settings.opening_receivables),
    opening_ppe: String(settings.opening_ppe),
    opening_payables: String(settings.opening_payables),
    opening_debt: String(settings.opening_debt),
    notes: settings.notes ?? "",
  };
}

export function FinancialSettingsPanel({
  context,
  settings,
  locked,
  onChanged,
}: {
  context: { company_id: number; exercise_id: number; version_id: number };
  settings: FinancialSettings;
  locked: boolean;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState(() => toForm(settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => setForm(toForm(settings)), [settings]);

  const save = async () => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const numeric = (key: keyof typeof form) => {
        const value = Number(form[key]);
        if (!Number.isFinite(value)) throw new Error("Todos los supuestos numéricos deben ser válidos.");
        return value;
      };
      const result = await apiRequest<{ message: string }>("/api/master-budget/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...context,
          tax_rate: numeric("tax_rate"),
          collection_rate: numeric("collection_rate"),
          payment_rate: numeric("payment_rate"),
          opening_cash: numeric("opening_cash"),
          opening_receivables: numeric("opening_receivables"),
          opening_ppe: numeric("opening_ppe"),
          opening_payables: numeric("opening_payables"),
          opening_debt: numeric("opening_debt"),
          notes: form.notes || null,
        }),
      });
      setSuccess(result.message);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar los supuestos.");
    } finally { setBusy(false); }
  };

  const field = (key: keyof typeof form, label: string, step = "0.01") => <Field label={label}><input type="number" step={step} disabled={locked} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></Field>;

  return <section className="panel">
    <div className="panel__heading"><div><span className="eyebrow">Supuestos de enlace</span><h2>Parámetros para el estado de situación financiera</h2><p>Son saldos iniciales y porcentajes necesarios para derivar los estados; no reemplazan sus cifras finales.</p></div></div>
    {error && <Message type="danger">{error}</Message>}
    {success && <Message type="success">{success}</Message>}
    <FormGrid>
      {field("tax_rate", "Impuesto a la renta (%)")}
      {field("collection_rate", "Cobranza del año (%)")}
      {field("payment_rate", "Pago de compras (%)")}
      {field("opening_cash", "Efectivo inicial")}
      {field("opening_receivables", "Cuentas por cobrar iniciales")}
      {field("opening_ppe", "Propiedad, planta y equipo inicial")}
      {field("opening_payables", "Cuentas por pagar iniciales")}
      {field("opening_debt", "Deuda inicial")}
      <Field label="Notas" span={2}><textarea disabled={locked} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
    </FormGrid>
    {!locked && <div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void save()}><Save size={16} />Guardar supuestos</button></div>}
  </section>;
}
