import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { CompaniesPage } from "./pages/phase2/CompaniesPage";
import { StructurePage } from "./pages/phase2/StructurePage";
import { ParametersPage } from "./pages/phase2/ParametersPage";
import { PeriodsPage } from "./pages/phase3/PeriodsPage";
import { VersionsPage } from "./pages/phase3/VersionsPage";
import { ImportPage } from "./pages/phase4/ImportPage";
import { OriginalBudgetPage } from "./pages/phase5/OriginalBudgetPage";
import { MasterBudgetPage } from "./pages/phase6/MasterBudgetPage";
import { ActualsPage } from "./pages/phase7/ActualsPage";
import { ForecastPage } from "./pages/phase7/ForecastPage";
import { FinancialAnalysisPage } from "./pages/phase8/FinancialAnalysisPage";
import { Phase9Page } from "./pages/phase9/Phase9Page";
import { EmailPage } from "./pages/phase10/EmailPage";
import { ProposalsPage } from "./pages/phase10/ProposalsPage";
import { ReportsPage } from "./pages/phase10/ReportsPage";

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
          <Route path="/informacion-real" element={<ActualsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/presupuesto-maestro" element={<MasterBudgetPage />} />
          <Route path="/estados-financieros" element={<FinancialAnalysisPage />} />
          <Route path="/analisis" element={<FinancialAnalysisPage />} />
          <Route path="/variaciones" element={<Phase9Page initialTab="Variaciones" />} />
          <Route path="/relevancia-costos" element={<Phase9Page initialTab="Relevancia de costos" />} />
          <Route path="/reportes" element={<ReportsPage />} />
          <Route path="/propuestas" element={<ProposalsPage />} />
          <Route path="/correo" element={<EmailPage />} />
          <Route path="/inicio" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
