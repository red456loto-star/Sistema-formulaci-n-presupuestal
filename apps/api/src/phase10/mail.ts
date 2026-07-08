import fs from "node:fs";
import path from "node:path";
import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { buildApprovedCenterMasterReport } from "../phase11/reports";
import { buildReport, type ReportInput } from "./report-model";
import { buildReportPdf, reportFileName } from "./report-export";

const nodemailer = require("nodemailer") as any;

export interface SmtpSettingsInput {
  host: string;
  port: number;
  secure: boolean;
  username?: string | null;
  password?: string | null;
  from_name: string;
  from_email: string;
}

export interface SendBudgetInput {
  company_id: number;
  exercise_id: number;
  version_id: number;
  center_id: number;
  period_number?: number | null;
  smtp: SmtpSettingsInput;
}

function validEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function loadDeliveryContext(database: DatabaseManager, input: SendBudgetInput) {
  const version = database.connection.prepare(`SELECT v.*,e.code exercise_code,e.budget_year,c.commercial_name company_name
    FROM budget_versions v JOIN budget_exercises e ON e.id=v.exercise_id JOIN companies c ON c.id=v.company_id
    WHERE v.id=? AND v.company_id=? AND v.exercise_id=?`).get(input.version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece a la empresa y ejercicio seleccionados.", 400);
  if (!["APROBADO", "CERRADO"].includes(String(version.status))) httpError("Solo se puede enviar una versión aprobada o cerrada.", 409);
  const center = database.connection.prepare(`SELECT c.*,r.full_name responsible_name,r.position responsible_position,r.email responsible_email,r.active responsible_active
    FROM activity_centers c JOIN responsibles r ON r.id=c.responsible_id
    WHERE c.id=? AND c.company_id=? AND c.active=1`).get(input.center_id, input.company_id) as Record<string, unknown> | undefined;
  if (!center) httpError("El centro seleccionado no pertenece a la empresa activa.", 400);
  if (!Number(center.responsible_active)) httpError("El responsable del centro está inactivo.", 409);
  if (!validEmail(center.responsible_email)) httpError("El responsable del centro no tiene un correo válido.", 400);
  let period: Record<string, unknown> | null = null;
  if (input.period_number) {
    period = database.connection.prepare("SELECT * FROM budget_periods WHERE company_id=? AND exercise_id=? AND period_number=?")
      .get(input.company_id, input.exercise_id, input.period_number) as Record<string, unknown> | undefined ?? null;
    if (!period) httpError("El periodo seleccionado no pertenece al ejercicio.", 400);
  }
  return { version, center, period };
}

function classifyFailure(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  const code = String(candidate?.code ?? "").toUpperCase();
  const message = candidate?.message || "No fue posible enviar el correo.";
  const pendingCodes = new Set(["ECONNECTION", "ETIMEDOUT", "ENETUNREACH", "EAI_AGAIN", "EDNS", "ESOCKET", "ECONNRESET"]);
  const pending = pendingCodes.has(code) || /network|internet|connect|timeout|dns|socket/i.test(message);
  return { status: pending ? "PENDIENTE" : "FALLIDO", message } as const;
}

function getSavedSettings(database: DatabaseManager, companyId: number) {
  return database.connection.prepare("SELECT company_id,host,port,secure,username,from_name,from_email,updated_at FROM smtp_settings WHERE company_id=?")
    .get(companyId) as Record<string, unknown> | undefined;
}

export function getSmtpSettings(database: DatabaseManager, companyId: number) {
  return getSavedSettings(database, companyId) ?? null;
}

export function saveSmtpSettings(database: DatabaseManager, companyId: number, input: Omit<SmtpSettingsInput, "password">) {
  const company = database.connection.prepare("SELECT id FROM companies WHERE id=? AND active=1").get(companyId);
  if (!company) httpError("La empresa seleccionada no existe o está inactiva.", 400);
  if (!validEmail(input.from_email)) httpError("El correo remitente no es válido.", 400);
  const stamp = new Date().toISOString();
  database.connection.prepare(`INSERT INTO smtp_settings (company_id,host,port,secure,username,from_name,from_email,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(company_id) DO UPDATE SET host=excluded.host,port=excluded.port,secure=excluded.secure,
      username=excluded.username,from_name=excluded.from_name,from_email=excluded.from_email,updated_at=excluded.updated_at`)
    .run(companyId, input.host.trim(), input.port, input.secure ? 1 : 0, input.username?.trim() || null, input.from_name.trim(), input.from_email.trim(), stamp);
  return getSmtpSettings(database, companyId);
}

async function deliver(settings: SmtpSettingsInput, delivery: Record<string, unknown>) {
  if (process.env.PRESUCONTROL_FORCE_OFFLINE === "1") {
    const offline = new Error("No existe conexión a internet. El documento quedó generado y el envío permanece pendiente.") as Error & { code?: string };
    offline.code = "ENETUNREACH";
    throw offline;
  }
  if (process.env.PRESUCONTROL_MAIL_TEST_MODE === "success") return { messageId: "phase10-test-success" };
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.username ? { user: settings.username, pass: settings.password ?? "" } : undefined,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
  await transport.verify();
  return transport.sendMail({
    from: { name: settings.from_name, address: settings.from_email },
    to: { name: String(delivery.recipient_name), address: String(delivery.recipient_email) },
    subject: String(delivery.subject),
    text: `Estimado(a) ${delivery.recipient_name}:\n\nSe adjunta el presupuesto aprobado correspondiente al centro ${delivery.center_code} · ${delivery.center_name}.\nVersión: ${delivery.version_code}.\n\nDocumento generado por PresuControl Empresarial.`,
    attachments: [{ filename: String(delivery.attachment_name), path: String(delivery.attachment_path), contentType: "application/pdf" }],
  });
}

async function generateAttachment(database: DatabaseManager, input: SendBudgetInput, context: ReturnType<typeof loadDeliveryContext>) {
  const masterReport = buildApprovedCenterMasterReport(database, input);
  const compatibilityPhase = Number(process.env.PRESUCONTROL_COMPAT_PHASE ?? 11);
  let report = masterReport;
  if (!report && compatibilityPhase <= 10) {
    const reportInput: ReportInput = {
      company_id: input.company_id,
      exercise_id: input.exercise_id,
      version_id: input.version_id,
      report_type: String(context.version.version_type) === "FORECAST" ? "FORECAST" : "ORIGINAL",
      period_number: input.period_number ?? null,
      center_id: input.center_id,
      responsible_id: Number(context.center.responsible_id),
    };
    report = buildReport(database, reportInput);
  }
  if (!report) httpError("No existe información maestra presupuestada para el centro, periodo y versión aprobada seleccionados.", 409);
  const pdf = await buildReportPdf(report);
  const outbox = path.join(database.dataDir, "phase10", "outbox");
  fs.mkdirSync(outbox, { recursive: true });
  const fileName = reportFileName(report, "pdf");
  const uniqueName = `${Date.now()}-${input.center_id}-${fileName}`;
  const filePath = path.join(outbox, uniqueName);
  fs.writeFileSync(filePath, pdf);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) httpError("No fue posible generar correctamente el documento PDF.", 500);
  return { fileName, filePath };
}

function deliveryById(database: DatabaseManager, id: number) {
  const row = database.connection.prepare(`SELECT d.*,c.code center_code,c.name center_name,v.code version_code,v.name version_name,
      e.code exercise_code,e.budget_year
    FROM email_deliveries d JOIN activity_centers c ON c.id=d.center_id JOIN budget_versions v ON v.id=d.version_id
    JOIN budget_exercises e ON e.id=d.exercise_id WHERE d.id=?`).get(id) as Record<string, unknown> | undefined;
  if (!row) httpError("El envío no existe.", 404);
  return row;
}

async function attemptDelivery(database: DatabaseManager, deliveryId: number, smtp: SmtpSettingsInput, isRetry: boolean) {
  const delivery = deliveryById(database, deliveryId);
  if (!fs.existsSync(String(delivery.attachment_path))) httpError("El documento adjunto ya no está disponible. Genere un nuevo envío.", 409);
  const stamp = new Date().toISOString();
  const retries = Number(delivery.retry_count) + (isRetry ? 1 : 0);
  try {
    await deliver(smtp, delivery);
    database.connection.prepare(`UPDATE email_deliveries SET status='ENVIADO',error_message=NULL,retry_count=?,last_attempt_at=?,sent_at=?,updated_at=? WHERE id=?`)
      .run(retries, stamp, stamp, stamp, deliveryId);
    return { ...deliveryById(database, deliveryId), message: "Presupuesto enviado correctamente." };
  } catch (error) {
    const failure = classifyFailure(error);
    database.connection.prepare("UPDATE email_deliveries SET status=?,error_message=?,retry_count=?,last_attempt_at=?,updated_at=? WHERE id=?")
      .run(failure.status, failure.message, retries, stamp, stamp, deliveryId);
    return { ...deliveryById(database, deliveryId), message: failure.status === "PENDIENTE" ? "No se pudo conectar. El documento quedó generado y el envío permanece pendiente." : "El servidor de correo rechazó el envío. Revise la configuración y vuelva a intentarlo." };
  }
}

export async function createAndSendBudget(database: DatabaseManager, input: SendBudgetInput) {
  if (!input.smtp.host.trim()) httpError("Ingrese el servidor SMTP.", 400);
  if (!validEmail(input.smtp.from_email)) httpError("El correo remitente no es válido.", 400);
  const context = loadDeliveryContext(database, input);
  const attachment = await generateAttachment(database, input, context);
  const stamp = new Date().toISOString();
  const subject = `Presupuesto aprobado ${context.version.code} · ${context.center.code} ${context.center.name}`;
  const id = Number(database.connection.prepare(`INSERT INTO email_deliveries
    (company_id,exercise_id,period_id,version_id,center_id,responsible_id,recipient_name,recipient_position,recipient_email,
     attachment_name,attachment_path,subject,status,error_message,retry_count,last_attempt_at,sent_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'PENDIENTE',NULL,0,NULL,NULL,?,?)`).run(
      input.company_id, input.exercise_id, context.period?.id ?? null, input.version_id, input.center_id, context.center.responsible_id,
      context.center.responsible_name, context.center.responsible_position, context.center.responsible_email,
      attachment.fileName, attachment.filePath, subject, stamp, stamp,
    ).lastInsertRowid);
  return attemptDelivery(database, id, input.smtp, false);
}

export async function retryBudgetDelivery(database: DatabaseManager, id: number, smtp: SmtpSettingsInput) {
  const delivery = deliveryById(database, id);
  if (String(delivery.status) === "ENVIADO") httpError("El envío ya fue completado.", 409);
  if (!validEmail(delivery.recipient_email)) httpError("El correo registrado en el historial no es válido.", 400);
  return attemptDelivery(database, id, smtp, true);
}

export function listDeliveries(database: DatabaseManager, companyId: number, exerciseId: number) {
  const exercise = database.connection.prepare("SELECT id FROM budget_exercises WHERE id=? AND company_id=?").get(exerciseId, companyId);
  if (!exercise) httpError("El ejercicio no pertenece a la empresa seleccionada.", 400);
  return database.connection.prepare(`SELECT d.id,d.company_id,d.exercise_id,d.period_id,d.version_id,d.center_id,d.responsible_id,
      d.recipient_name,d.recipient_position,d.recipient_email,d.attachment_name,d.subject,d.status,d.error_message,
      d.retry_count,d.last_attempt_at,d.sent_at,d.created_at,d.updated_at,c.code center_code,c.name center_name,
      v.code version_code,v.name version_name,v.status version_status,p.period_number,p.name period_name
    FROM email_deliveries d JOIN activity_centers c ON c.id=d.center_id JOIN budget_versions v ON v.id=d.version_id
    LEFT JOIN budget_periods p ON p.id=d.period_id WHERE d.company_id=? AND d.exercise_id=? ORDER BY d.created_at DESC,d.id DESC`).all(companyId, exerciseId);
}

export function getDeliveryAttachment(database: DatabaseManager, id: number) {
  const delivery = deliveryById(database, id);
  const filePath = String(delivery.attachment_path);
  if (!fs.existsSync(filePath)) httpError("El documento adjunto ya no está disponible.", 404);
  return { delivery, buffer: fs.readFileSync(filePath) };
}
