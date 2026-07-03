import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DashboardPage } from "./pages/DashboardPage";
import { ModulePage } from "./pages/ModulePage";
import { SystemStatusPage } from "./pages/SystemStatusPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LoginPage } from "./pages/phase2/LoginPage";
import { CompaniesPage } from "./pages/phase2/CompaniesPage";
import { StructurePage } from "./pages/phase2/StructurePage";
import { UsersPage } from "./pages/phase2/UsersPage";
import { ParametersPage } from "./pages/phase2/ParametersPage";
import { AuditPage } from "./pages/phase2/AuditPage";

const futureModules = [
  ["/periodos", "Periodos", "Ejercicios y periodos presupuestales."],
  ["/versiones", "Versiones", "Escenarios, versiones y estados de aprobación."],
  ["/importacion", "Importación", "Importación inteligente de información empresarial."],
  ["/presupuesto-original", "Presupuesto original", "Formulación anual mensualizada y proyección."],
  ["/forecast", "Forecast", "Presupuesto revisado con valores reales y proyectados."],
  ["/presupuesto-maestro", "Presupuesto maestro", "Consolidación operativa y financiera."],
  ["/estados-financieros", "Estados financieros", "Estados presupuestados y comparativos."],
  ["/control", "Control presupuestal", "Presupuesto, real, comprometido y disponible."],
  ["/analisis", "Análisis", "Variaciones, relevancia e indicadores financieros."],
  ["/reportes", "Reportes", "Consultas, impresión y exportaciones."],
  ["/propuestas", "Propuestas de mejora", "Acciones sustentadas en resultados presupuestales."],
  ["/configuracion", "Configuración", "Parámetros generales y mantenimiento local."],
] as const;

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="brand__mark brand__mark--large">PC</div><strong>Iniciando PresuControl...</strong></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <WorkspaceProvider><Routes>
    <Route element={<AppLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="/empresas" element={<CompaniesPage />} />
      <Route path="/estructura" element={<StructurePage />} />
      <Route path="/usuarios" element={<UsersPage />} />
      <Route path="/parametros" element={<ParametersPage />} />
      <Route path="/auditoria" element={<AuditPage />} />
      {futureModules.map(([path, title, description]) => <Route key={path} path={path} element={<ModulePage title={title} description={description} />} />)}
      <Route path="/estado-sistema" element={<SystemStatusPage />} />
      <Route path="/inicio" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes></WorkspaceProvider>;
}

export default function App() {
  return <AuthProvider><Routes><Route path="/login" element={<LoginPage />} /><Route path="/*" element={<ProtectedRoutes />} /></Routes></AuthProvider>;
}
