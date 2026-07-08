import { useEffect, useMemo, useState } from "react";
import { Download, Mail, RefreshCw, Save, Send, WifiOff } from "lucide-react";
import { DataTable, Field, FormGrid, Message } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import type { EmailDelivery, Phase10Options, SmtpSettings } from "./types";
import { downloadPhase10Get } from "./utils";

const EMPTY_OPTIONS: Phase10Options = { versions: [], approved_versions: [], centers: [], responsibles: [] };
const EMPTY_SMTP: SmtpSettings = { host: "", port: 587, secure: false, username: "", password: "", from_name: "PresuControl Empresarial", from_email: "" };

export function EmailPage() {
  const { companyId, exerciseId, versionId, period } = useWorkspace();
  const [options, setOptions] = useState<Phase10Options>(EMPTY_OPTIONS);
  const [history, setHistory] = useState<EmailDelivery[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [centerId, setCenterId] = useState("");
  const [periodNumber, setPeriodNumber] = useState("");
  const [smtp, setSmtp] = useState<SmtpSettings>(EMPTY_SMTP);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setPeriodNumber(period ? String(period.period_number) : ""), [period?.id]);

  const load = async () => {
    if (!companyId || !exerciseId) {
      setOptions(EMPTY_OPTIONS); setHistory([]); setSelectedVersion(""); setCenterId(""); return;
    }
    setBusy(true); setError("");
    try {
      const [nextOptions, nextHistory, saved] = await Promise.all([
        apiRequest<Phase10Options>(`/api/phase10/options?company_id=${companyId}&exercise_id=${exerciseId}`),
        apiRequest<EmailDelivery[]>(`/api/phase10/email-history?company_id=${companyId}&exercise_id=${exerciseId}`),
        apiRequest<Omit<SmtpSettings, "password"> | null>(`/api/phase10/smtp-settings?company_id=${companyId}`),
      ]);
      setOptions(nextOptions);
      setHistory(nextHistory);
      const preferred = nextOptions.approved_versions.find((item) => item.id === versionId) ?? nextOptions.approved_versions[0];
      setSelectedVersion((current) => nextOptions.approved_versions.some((item) => item.id === Number(current)) ? current : preferred ? String(preferred.id) : "");
      setCenterId((current) => nextOptions.centers.some((item) => item.id === Number(current)) ? current : nextOptions.centers[0] ? String(nextOptions.centers[0].id) : "");
      if (saved) setSmtp((current) => ({ ...current, ...saved, secure: Boolean(saved.secure), password: "" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar el módulo de correo.");
    } finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, [companyId, exerciseId, versionId]);

  const selectedCenter = useMemo(() => options.centers.find((item) => item.id === Number(centerId)), [options.centers, centerId]);
  const selectedVersionInfo = useMemo(() => options.approved_versions.find((item) => item.id === Number(selectedVersion)), [options.approved_versions, selectedVersion]);

  const smtpBody = () => ({
    host: smtp.host.trim(),
    port: Number(smtp.port),
    secure: Boolean(smtp.secure),
    username: smtp.username?.trim() || null,
    password: smtp.password || null,
    from_name: smtp.from_name.trim(),
    from_email: smtp.from_email.trim(),
  });

  const validateSend = () => {
    if (!companyId || !exerciseId) throw new Error("Seleccione empresa y ejercicio.");
    if (!selectedVersion) throw new Error("Seleccione una versión aprobada o cerrada.");
    if (!centerId) throw new Error("Seleccione el centro que recibirá su presupuesto.");
    if (!smtp.host.trim() || !smtp.from_email.trim()) throw new Error("Complete el servidor SMTP y el correo remitente.");
    return { company_id: companyId, exercise_id: exerciseId, version_id: Number(selectedVersion), center_id: Number(centerId), period_number: periodNumber ? Number(periodNumber) : null, smtp: smtpBody() };
  };

  const saveSettings = async () => {
    if (!companyId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiRequest<{ message: string }>("/api/phase10/smtp-settings", {
        method: "PUT",
        body: JSON.stringify({ company_id: companyId, smtp: { ...smtpBody(), password: undefined } }),
      });
      setMessage(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar la configuración."); }
    finally { setBusy(false); }
  };

  const sendBudget = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiRequest<EmailDelivery>("/api/phase10/email/send", { method: "POST", body: JSON.stringify(validateSend()) });
      setMessage(result.message ?? (result.status === "ENVIADO" ? "Presupuesto enviado correctamente." : "El envío quedó registrado."));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible preparar el envío."); }
    finally { setBusy(false); }
  };

  const retry = async (delivery: EmailDelivery) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiRequest<EmailDelivery>(`/api/phase10/email/${delivery.id}/retry`, { method: "POST", body: JSON.stringify({ smtp: smtpBody() }) });
      setMessage(result.message ?? "Reintento registrado.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible reintentar el envío."); }
    finally { setBusy(false); }
  };

  const download = async (delivery: EmailDelivery) => {
    setError("");
    try { await downloadPhase10Get(`/api/phase10/email/${delivery.id}/attachment`, delivery.attachment_name); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible descargar el documento."); }
  };

  return <div className="page-stack phase10-page">
    <section className="page-heading">
      <div><span className="eyebrow">Fase 10 · Distribución por centro</span><h1>Correo del presupuesto aprobado</h1><p>Genera el PDF localmente, lo envía al responsable registrado y conserva el historial de pendientes, errores y reintentos.</p></div>
      <button className="button button--ghost" disabled={busy || !companyId || !exerciseId} onClick={() => void load()}><RefreshCw size={16} />Actualizar</button>
    </section>
    {error && <Message type="danger">{error}</Message>}
    {message && <Message type="success">{message}</Message>}
    {!companyId || !exerciseId ? <Message>Seleccione una empresa y un ejercicio en la barra superior.</Message> : <>
      <section className="grid-2 phase10-mail-grid">
        <article className="panel">
          <div className="panel__heading"><div><span className="eyebrow">Documento y destinatario</span><h2>Presupuesto por centro</h2></div><Mail size={22} /></div>
          <FormGrid>
            <Field label="Versión aprobada"><select value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)}><option value="">Seleccione</option>{options.approved_versions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.version_type} · {item.status}</option>)}</select></Field>
            <Field label="Centro"><select value={centerId} onChange={(event) => setCenterId(event.target.value)}><option value="">Seleccione</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
            <Field label="Periodo"><select value={periodNumber} onChange={(event) => setPeriodNumber(event.target.value)}><option value="">Total anual</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, "0")}</option>)}</select></Field>
          </FormGrid>
          <div className="phase10-recipient-card">
            <span>Responsable empresarial</span>
            <strong>{selectedCenter?.responsible_name ?? "Seleccione un centro"}</strong>
            <p>{selectedCenter ? `${selectedCenter.responsible_position} · ${selectedCenter.responsible_email}` : "El destinatario se obtiene del catálogo; no se crea una cuenta de acceso."}</p>
          </div>
          {!options.approved_versions.length && <Message type="danger">No existen versiones aprobadas o cerradas para enviar.</Message>}
          <button className="button button--primary" disabled={busy || !selectedVersion || !centerId} onClick={() => void sendBudget()}><Send size={16} />{busy ? "Procesando..." : "Generar PDF y enviar"}</button>
        </article>

        <article className="panel">
          <div className="panel__heading"><div><span className="eyebrow">Configuración estrictamente necesaria</span><h2>Servidor de correo</h2></div><Save size={22} /></div>
          <FormGrid>
            <Field label="Servidor SMTP"><input value={smtp.host} onChange={(event) => setSmtp({ ...smtp, host: event.target.value })} placeholder="smtp.empresa.com" /></Field>
            <Field label="Puerto"><input type="number" min="1" max="65535" value={smtp.port} onChange={(event) => setSmtp({ ...smtp, port: Number(event.target.value) })} /></Field>
            <Field label="Conexión segura"><select value={smtp.secure ? "1" : "0"} onChange={(event) => setSmtp({ ...smtp, secure: event.target.value === "1" })}><option value="0">STARTTLS / puerto 587</option><option value="1">SSL / puerto 465</option></select></Field>
            <Field label="Usuario SMTP"><input value={smtp.username ?? ""} onChange={(event) => setSmtp({ ...smtp, username: event.target.value })} placeholder="Opcional" /></Field>
            <Field label="Contraseña o clave de aplicación"><input type="password" value={smtp.password ?? ""} onChange={(event) => setSmtp({ ...smtp, password: event.target.value })} autoComplete="new-password" /></Field>
            <Field label="Nombre remitente"><input value={smtp.from_name} onChange={(event) => setSmtp({ ...smtp, from_name: event.target.value })} /></Field>
            <Field label="Correo remitente"><input type="email" value={smtp.from_email} onChange={(event) => setSmtp({ ...smtp, from_email: event.target.value })} /></Field>
          </FormGrid>
          <Message>La contraseña se utiliza solo durante el envío o reintento actual y no se almacena en SQLite.</Message>
          <button className="button button--ghost" disabled={busy || !smtp.host || !smtp.from_email} onClick={() => void saveSettings()}><Save size={16} />Guardar datos no secretos</button>
        </article>
      </section>

      <section className="panel">
        <div className="panel__heading"><div><span className="eyebrow">Trazabilidad y funcionamiento sin internet</span><h2>Historial de envíos</h2></div><WifiOff size={22} /></div>
        <DataTable headers={["Fecha", "Centro", "Versión", "Responsable", "Correo", "Periodo", "Documento", "Estado", "Reintentos", "Error", "Acciones"]} rows={history.map((row) => [
          formatDate(row.created_at), `${row.center_code} · ${row.center_name}`, `${row.version_code} · ${row.version_name}`, `${row.recipient_name} · ${row.recipient_position}`,
          row.recipient_email, row.period_number ? `${row.period_number} · ${row.period_name}` : "Total anual", row.attachment_name,
          <span key="status" className={`phase10-status phase10-status--${row.status.toLowerCase()}`}>{row.status}</span>, row.retry_count,
          row.error_message ?? "—", <div key="actions" className="button-row"><button className="button button--tiny" onClick={() => void download(row)} title="Descargar PDF"><Download size={14} /></button>{row.status !== "ENVIADO" && <button className="button button--tiny" disabled={busy} onClick={() => void retry(row)} title="Reintentar"><RefreshCw size={14} /></button>}</div>,
        ])} empty="Todavía no se han generado envíos para este ejercicio." />
      </section>
    </>}
  </div>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(date);
}
