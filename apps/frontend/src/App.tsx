import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DashboardPage } from "./pages/DashboardPage";
import { ModulePage } from "./pages/ModulePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { CompaniesPage } from "./pages/phase2/CompaniesPage";
import { StructurePage } from "./pages/phase2/StructurePage";
import { ParametersPage } from "./pages/phase2/ParametersPage";
import { PeriodsPage } from "./pages/phase3/PeriodsPage";
import { VersionsPage } from "./pages/phase3/VersionsPage";
import { ImportPage } from "./pages/phase4/ImportPage";
import { OriginalBudgetPage } from "./pages/phase5/OriginalBudgetPage";

const futureModules = [
  ["/forecast", "Forecast", "Presupuesto revisado con valores reales y proyectados."],
  ["/presupuesto-maestro", "Presupuesto maestro", "Ventas, inventarios, compras, producción, costos, gastos e inversión."],
  ["/estados-financieros", "Estados financieros", "Estado de situación financiera y estado de resultados presupuestados."],
  ["/analisis", "Análisis", "Análisis vertical, horizontal, ratios, Dupont, EVA, relevancia y variaciones."],
  ["/reportes", "Reportes", "Reportes en pantalla, impresos y exportables."],
  ["/propuestas", "Propuestas de mejora", "Propuestas con impacto positivo en la rentabilidad."],
  ["/correo", "Envío por correo", "Distribución del presupuesto aprobado a responsables de centros."],
] as const;

export default function App() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/empresas" element={<CompaniesPage />} />
          <Route path="/estructura" element={<StructurePage />} />
          <Route path="/parametros" element={<ParametersPage />} />
          <Route path="/periodos" element={<PeriodsPage />} />
          <Route path="/versiones" element={<VersionsPage />} />
          <Route path="/importacion" element={<ImportPage />} />
          <Route path="/presupuesto-original" element={<OriginalBudgetPage />} />
          {futureModules.map(([path, title, description]) => (
            <Route key={path} path={path} element={<ModulePage title={title} description={description} />} />
          ))}
          <Route path="/inicio" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
