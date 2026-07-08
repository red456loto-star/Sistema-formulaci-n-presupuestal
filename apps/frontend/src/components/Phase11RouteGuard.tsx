import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Message } from "./phase2/Ui";
import { useWorkspace } from "../context/WorkspaceContext";

export type Phase11Requirement = "COMPANY" | "PERIOD_VERSION" | "BUDGET_TYPE" | "MASTER_DATA";

const destinations: Record<Phase11Requirement, { route: string; label: string }> = {
  COMPANY: { route: "/empresa-perfil", label: "Empresa y perfil" },
  PERIOD_VERSION: { route: "/periodos-versiones", label: "Periodos y versiones" },
  BUDGET_TYPE: { route: "/tipos-presupuesto", label: "Tipos de presupuesto" },
  MASTER_DATA: { route: "/tablas-maestras", label: "Tablas maestras" },
};

export function requirementSatisfied(requirement: Phase11Requirement, values: ReturnType<typeof useWorkspace>) {
  if (requirement === "COMPANY") return Boolean(values.companyId);
  if (requirement === "PERIOD_VERSION") return Boolean(values.companyId && values.exerciseId && values.periodId && values.versionId);
  if (requirement === "BUDGET_TYPE") return Boolean(values.companyId && values.exerciseId && values.periodId && values.versionId && values.budgetTypeId);
  return Boolean(values.workflowStatus?.master_data_ready);
}

export function Phase11RouteGuard({ requirement, children }: { requirement: Phase11Requirement; children: ReactNode }) {
  const workspace = useWorkspace();
  if (requirementSatisfied(requirement, workspace)) return <>{children}</>;
  const destination = destinations[requirement];
  return <div className="page-stack phase11-page">
    <section className="panel phase11-lock-panel">
      <LockKeyhole size={34} />
      <span className="eyebrow">Opción subordinada</span>
      <h1>Complete primero {destination.label}</h1>
      <p>Esta pantalla permanece bloqueada para evitar mezclar empresas, periodos, versiones, tipos de presupuesto o análisis sin información maestra.</p>
      <Message type="danger">La jerarquía obligatoria debe completarse en el orden mostrado en el menú lateral.</Message>
      <Link className="button button--primary" to={destination.route}>Ir a {destination.label}</Link>
    </section>
  </div>;
}
