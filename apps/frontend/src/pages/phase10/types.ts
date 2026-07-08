export type ReportType = "ORIGINAL" | "FORECAST" | "MASTER" | "FINANCIAL" | "VARIANCES" | "CENTERS" | "EXECUTIVE" | "DASHBOARD" | "PROPOSALS";
export type ReportValueType = "text" | "money" | "percent" | "number" | "date" | "status";
export type ProposalPriority = "ALTA" | "MEDIA" | "BAJA";
export type ProposalStatus = "PROPUESTA" | "APROBADA" | "EN_EJECUCION" | "IMPLEMENTADA" | "DESCARTADA";

export interface Phase10Options {
  versions: VersionOption[];
  approved_versions: VersionOption[];
  centers: CenterOption[];
  responsibles: ResponsibleOption[];
}

export interface VersionOption {
  id: number;
  code: string;
  name: string;
  version_type: "ORIGINAL" | "FORECAST";
  status: string;
  source_version_id: number | null;
  approved_at: string | null;
  closed_at: string | null;
}

export interface CenterOption {
  id: number;
  code: string;
  name: string;
  center_type: string;
  responsible_id: number;
  responsible_name: string;
  responsible_position: string;
  responsible_email: string;
}

export interface ResponsibleOption {
  id: number;
  code: string;
  full_name: string;
  position: string;
  email: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportValueType;
}

export interface ReportDocument {
  report_type: ReportType;
  title: string;
  subtitle: string;
  file_slug: string;
  context: {
    company_name: string;
    exercise_code: string;
    budget_year: number;
    version_code: string;
    version_name: string;
    version_type: string;
    version_status: string;
    currency_code: string;
    period_label: string;
    center_label: string;
    responsible_label: string;
  };
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  summary: Array<{ label: string; value: unknown; type: ReportValueType }>;
  notes: string[];
  generated_at: string;
}

export interface SmtpSettings {
  company_id?: number;
  host: string;
  port: number;
  secure: boolean | number;
  username: string | null;
  password?: string;
  from_name: string;
  from_email: string;
  updated_at?: string;
}

export interface EmailDelivery {
  id: number;
  company_id: number;
  exercise_id: number;
  period_id: number | null;
  version_id: number;
  center_id: number;
  responsible_id: number;
  recipient_name: string;
  recipient_position: string;
  recipient_email: string;
  attachment_name: string;
  subject: string;
  status: "PENDIENTE" | "ENVIADO" | "FALLIDO";
  error_message: string | null;
  retry_count: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  created_at: string;
  center_code: string;
  center_name: string;
  version_code: string;
  version_name: string;
  period_number: number | null;
  period_name: string | null;
  message?: string;
}

export interface Proposal {
  id: number;
  company_id: number;
  exercise_id: number;
  period_id: number | null;
  version_id: number;
  center_id: number | null;
  element_id: number | null;
  account_id: number | null;
  source_type: string;
  problem: string;
  evidence_value: number;
  evidence_unit: string;
  evidence_text: string;
  probable_cause: string;
  proposed_action: string;
  expected_impact: number;
  profitability_impact: number | null;
  responsible_id: number;
  priority: ProposalPriority;
  due_date: string;
  status: ProposalStatus;
  center_code?: string;
  center_name?: string;
  element_code?: string;
  element_name?: string;
  account_code?: string;
  account_name?: string;
  responsible_name: string;
  responsible_position: string;
  version_code: string;
  version_name: string;
  period_number?: number;
  period_name?: string;
}

export interface ProposalSuggestion extends Omit<Proposal, "id" | "created_at" | "updated_at"> {
  period_label: string;
  center_label: string;
  element_label: string;
  account_label: string;
  source_reference?: string | null;
}
