import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Message, Tabs } from "../../components/phase2/Ui";
import { useWorkspace } from "../../context/WorkspaceContext";
import { PeriodsPage } from "../phase3/PeriodsPage";
import { VersionsPage } from "../phase3/VersionsPage";

export function PeriodVersionPage() {
  const [tab, setTab] = useState("Ejercicios y periodos");
  const { companyId } = useWorkspace();
  return <div className="page-stack phase11-page">
    <section className="page-heading">
      <div><span className="eyebrow">Paso 2 · Base temporal y multiversión</span><h1>Periodos y versiones</h1><p>El ejercicio, el periodo y la versión se administran en una sola opción y constituyen el segundo nivel obligatorio del flujo.</p></div>
      <span className="status-pill status-pill--success"><CalendarRange size={16} /> Misma jerarquía</span>
    </section>
    {!companyId && <Message type="danger">Primero seleccione o registre una empresa en “Empresa y perfil”.</Message>}
    <Tabs items={["Ejercicios y periodos", "Versiones"]} active={tab} onChange={setTab} />
    <div className="phase11-embedded-page">
      {tab === "Ejercicios y periodos" ? <PeriodsPage /> : <VersionsPage />}
    </div>
  </div>;
}
