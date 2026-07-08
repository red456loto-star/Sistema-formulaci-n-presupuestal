import { DatabaseManager } from "../../../../packages/database/src/index";
import { httpError } from "../phase3/common";
import { buildPhase9Analysis, type Phase9Input } from "../phase9/calculations";
import { buildReport as buildBaseReport, type ReportDocument, type ReportInput } from "./report-model";

function sum(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((total, row) => total + (Number.isFinite(Number(row[key])) ? Number(row[key]) : 0), 0);
}

function phase9Input(database: DatabaseManager, input: ReportInput): Phase9Input {
  const version = database.connection.prepare("SELECT * FROM budget_versions WHERE id=? AND company_id=? AND exercise_id=?")
    .get(input.version_id, input.company_id, input.exercise_id) as Record<string, unknown> | undefined;
  if (!version) httpError("La versión no pertenece a la empresa y ejercicio seleccionados.", 400);
  if (String(version.version_type) === "FORECAST") {
    const profile = database.connection.prepare("SELECT original_version_id FROM forecast_profiles WHERE forecast_version_id=?")
      .get(input.version_id) as { original_version_id: number } | undefined;
    if (!profile) httpError("La versión forecast no tiene perfil asociado.", 409);
    return {
      company_id: input.company_id,
      exercise_id: input.exercise_id,
      original_version_id: Number(profile.original_version_id),
      forecast_version_id: input.version_id,
      period_number: input.period_number ?? null,
      center_id: input.center_id ?? null,
      comparison: "ORIGINAL_FORECAST",
      materiality_threshold: 10,
    };
  }
  return {
    company_id: input.company_id,
    exercise_id: input.exercise_id,
    original_version_id: input.version_id,
    forecast_version_id: null,
    period_number: input.period_number ?? null,
    center_id: input.center_id ?? null,
    comparison: "ORIGINAL_REAL",
    materiality_threshold: 10,
  };
}

function buildCentersReport(database: DatabaseManager, input: ReportInput): ReportDocument {
  const base = buildBaseReport(database, { ...input, report_type: "VARIANCES" });
  const analysis = buildPhase9Analysis(database, phase9Input(database, input));
  const rows = analysis.variations.centers.map((center) => {
    const detail = database.connection.prepare(`SELECT c.id,c.code,c.name,s.name site_name,r.full_name responsible_name,
      r.position responsible_position,r.email responsible_email
      FROM activity_centers c JOIN sites s ON s.id=c.site_id JOIN responsibles r ON r.id=c.responsible_id
      WHERE c.id=? AND c.company_id=?`).get(Number(center.id), input.company_id) as Record<string, unknown> | undefined;
    return {
      center_id: center.id,
      center_code: center.code,
      center_name: center.name,
      site_name: detail?.site_name ?? null,
      responsible_name: detail?.responsible_name ?? null,
      responsible_position: detail?.responsible_position ?? null,
      responsible_email: detail?.responsible_email ?? null,
      original_value: center.base_value,
      current_value: center.comparison_value,
      variation: center.monetary_variation,
      execution_percentage: center.base_value === 0 ? null : center.comparison_value / Math.abs(center.base_value) * 100,
      participation_percentage: center.participation_percentage,
      variance_impact_percentage: center.variance_impact_percentage,
      unfavorable_impact: center.unfavorable_impact,
      material: center.material ? "Sí" : "No",
    };
  });
  return {
    ...base,
    report_type: "CENTERS",
    title: "Presupuesto por centros de actividad",
    subtitle: `${analysis.context.base_label} versus ${analysis.context.comparison_label} · responsable, participación y desviación`,
    file_slug: `centros-${base.context.version_code}`,
    columns: [
      { key: "center_code", label: "Centro", type: "text" },
      { key: "center_name", label: "Nombre", type: "text" },
      { key: "site_name", label: "Sede", type: "text" },
      { key: "responsible_name", label: "Responsable", type: "text" },
      { key: "responsible_position", label: "Cargo", type: "text" },
      { key: "responsible_email", label: "Correo", type: "text" },
      { key: "original_value", label: analysis.context.base_label, type: "money" },
      { key: "current_value", label: analysis.context.comparison_label, type: "money" },
      { key: "variation", label: "Variación", type: "money" },
      { key: "execution_percentage", label: "Ejecución %", type: "percent" },
      { key: "participation_percentage", label: "Participación %", type: "percent" },
      { key: "variance_impact_percentage", label: "Impacto %", type: "percent" },
      { key: "unfavorable_impact", label: "Impacto desfavorable", type: "money" },
      { key: "material", label: "Material", type: "status" },
    ],
    rows,
    summary: [
      { label: "Total base", value: sum(rows, "original_value"), type: "money" },
      { label: "Total comparado", value: sum(rows, "current_value"), type: "money" },
      { label: "Variación", value: sum(rows, "variation"), type: "money" },
      { label: "Centros", value: rows.length, type: "number" },
    ],
    notes: [...analysis.warnings, ...(rows.length ? [] : ["No existen datos comparables por centro para los filtros seleccionados."])],
  };
}

export function buildReport(database: DatabaseManager, input: ReportInput) {
  return input.report_type === "CENTERS" ? buildCentersReport(database, input) : buildBaseReport(database, input);
}
