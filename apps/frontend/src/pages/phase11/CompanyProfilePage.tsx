import { useState } from "react";
import { Building2, FolderTree } from "lucide-react";
import { Tabs } from "../../components/phase2/Ui";
import { CompaniesPage } from "../phase2/CompaniesPage";
import { StructurePage } from "../phase2/StructurePage";

export function CompanyProfilePage() {
  const [tab, setTab] = useState("Empresa y perfil");
  return <div className="page-stack phase11-page">
    <section className="page-heading">
      <div><span className="eyebrow">Paso 1 · Contexto empresarial</span><h1>Empresa y perfil</h1><p>Registre primero la empresa, sus sedes, responsables, centros y estructura presupuestal. Todo el flujo posterior depende de este contexto.</p></div>
      <span className="status-pill status-pill--success"><Building2 size={16} /> Primera jerarquía</span>
    </section>
    <Tabs items={["Empresa y perfil", "Estructura y centros"]} active={tab} onChange={setTab} />
    <div className="phase11-embedded-page">
      {tab === "Empresa y perfil" ? <CompaniesPage /> : <StructurePage />}
    </div>
    {tab === "Estructura y centros" && <div className="phase11-guidance"><FolderTree size={18} /><span>Los centros y responsables registrados aquí serán utilizados por las tablas maestras, las propuestas y el envío por correo.</span></div>}
  </div>;
}
