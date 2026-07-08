import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Phase11RouteGuard } from "./components/Phase11RouteGuard";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { NotFoundPage } from "./pages/NotFoundPage";
import { EmailPage } from "./pages/phase10/EmailPage";
import { AnalysisWorkspacePage } from "./pages/phase11/AnalysisWorkspacePage";
import { BudgetTypesPage } from "./pages/phase11/BudgetTypesPage";
import { CompanyProfilePage } from "./pages/phase11/CompanyProfilePage";
import { MasterDataPage } from "./pages/phase11/MasterDataPage";
import { PeriodVersionPage } from "./pages/phase11/PeriodVersionPage";
import { Phase11ProposalsPage } from "./pages/phase11/ProposalsPage";

export default function App() {
  return <WorkspaceProvider>
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/empresa-perfil" replace />} />
        <Route path="/empresa-perfil" element={<CompanyProfilePage />} />
        <Route path="/periodos-versiones" element={<Phase11RouteGuard requirement="COMPANY"><PeriodVersionPage /></Phase11RouteGuard>} />
        <Route path="/tipos-presupuesto" element={<Phase11RouteGuard requirement="PERIOD_VERSION"><BudgetTypesPage /></Phase11RouteGuard>} />
        <Route path="/tablas-maestras" element={<Phase11RouteGuard requirement="BUDGET_TYPE"><MasterDataPage /></Phase11RouteGuard>} />
        <Route path="/analisis-financiero-integral" element={<Phase11RouteGuard requirement="MASTER_DATA"><AnalysisWorkspacePage mode="FINANCIAL" /></Phase11RouteGuard>} />
        <Route path="/relevancia-costos" element={<Phase11RouteGuard requirement="MASTER_DATA"><AnalysisWorkspacePage mode="COSTS" /></Phase11RouteGuard>} />
        <Route path="/variaciones" element={<Phase11RouteGuard requirement="MASTER_DATA"><AnalysisWorkspacePage mode="VARIATIONS" /></Phase11RouteGuard>} />
        <Route path="/dashboard-presupuestal" element={<Phase11RouteGuard requirement="MASTER_DATA"><AnalysisWorkspacePage mode="DASHBOARD" /></Phase11RouteGuard>} />
        <Route path="/propuestas" element={<Phase11RouteGuard requirement="MASTER_DATA"><Phase11ProposalsPage /></Phase11RouteGuard>} />
        <Route path="/correo" element={<Phase11RouteGuard requirement="MASTER_DATA"><EmailPage /></Phase11RouteGuard>} />

        <Route path="/empresas" element={<Navigate to="/empresa-perfil" replace />} />
        <Route path="/estructura" element={<Navigate to="/empresa-perfil" replace />} />
        <Route path="/periodos" element={<Navigate to="/periodos-versiones" replace />} />
        <Route path="/versiones" element={<Navigate to="/periodos-versiones" replace />} />
        <Route path="/parametros" element={<Navigate to="/tablas-maestras" replace />} />
        <Route path="/importacion" element={<Navigate to="/tablas-maestras" replace />} />
        <Route path="/presupuesto-original" element={<Navigate to="/tablas-maestras" replace />} />
        <Route path="/informacion-real" element={<Navigate to="/tablas-maestras" replace />} />
        <Route path="/forecast" element={<Navigate to="/tablas-maestras" replace />} />
        <Route path="/presupuesto-maestro" element={<Navigate to="/tablas-maestras" replace />} />
        <Route path="/estados-financieros" element={<Navigate to="/analisis-financiero-integral" replace />} />
        <Route path="/analisis" element={<Navigate to="/analisis-financiero-integral" replace />} />
        <Route path="/reportes" element={<Navigate to="/dashboard-presupuestal" replace />} />
        <Route path="/inicio" element={<Navigate to="/empresa-perfil" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </WorkspaceProvider>;
}
