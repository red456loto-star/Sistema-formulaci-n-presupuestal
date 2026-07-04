export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export interface ImportTarget {
  key: string;
  label: string;
  companyScoped: boolean;
  fields: ImportField[];
}

export interface SheetInspection {
  name: string;
  header_row: number;
  headers: string[];
  preview: Array<Record<string, string>>;
  row_count: number;
}

export interface InspectResponse {
  file_name: string;
  sheets: SheetInspection[];
}

export interface ImportRow {
  row_number: number;
  raw: Record<string, string>;
  values: Record<string, string | number | null>;
  status: "VALIDO" | "OBSERVADO" | "RECHAZADO" | "EXCLUIDO";
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  excluded: boolean;
}

export interface AnalysisResponse {
  target: ImportTarget;
  mapping: Record<string, string>;
  summary: {
    rows_read: number;
    rows_valid: number;
    rows_observed: number;
    rows_rejected: number;
    duplicates: number;
  };
  rows: ImportRow[];
}

export interface ImportBatch {
  id: number;
  company_id?: number | null;
  target_table: string;
  file_name: string;
  sheet_name: string;
  status: string;
  rows_read: number;
  rows_valid: number;
  rows_observed: number;
  rows_rejected: number;
  rows_excluded: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  created_at: string;
}

export interface RealDataSource {
  id: number;
  company_name: string;
  source_url: string;
  source_period?: string | null;
  consulted_at: string;
  verified_fields: string;
  transformations?: string | null;
  notes?: string | null;
}
