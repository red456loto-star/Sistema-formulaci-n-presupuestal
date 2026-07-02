import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ModulePage } from "./pages/ModulePage";
import { SystemStatusPage } from "./pages/SystemStatusPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const modules = [
  ["/empresas", "Empresas", "Administración de empresas, sedes y responsables."],
  ["/estructura", "Estructura presupuestal", "Centros, grupos, elementos y cuentas presupuestales."],
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

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        {modules.map(([path, title, description]) => (
          <Route
            key={path}
            path={path}
            element={<ModulePage title={title} description={description} />}
          />
        ))}
        <Route path="/estado-sistema" element={<SystemStatusPage />} />
        <Route path="/inicio" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
