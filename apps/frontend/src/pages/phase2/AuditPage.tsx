import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { apiRequest } from "../../lib/api";
import { DataTable, Message } from "../../components/phase2/Ui";

type AuditRow = { id: number; action: string; entity: string; description: string; user_name?: string; company_name?: string; created_at: string };

export function AuditPage() {
  const { companyId } = useWorkspace();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<AuditRow[]>(`/api/audit?limit=200${companyId ? `&company_id=${companyId}` : ""}`)
      .then(setRows)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [companyId]);

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">Fase 2 · Trazabilidad</span><h1>Auditoría de operaciones</h1><p>Registro local de creaciones, modificaciones, desactivaciones y cambios de seguridad.</p></div></section>
    {error && <Message type="danger">{error}</Message>}
    <section className="panel">
      <div className="panel__heading"><div><span className="eyebrow">Historial</span><h2>Eventos recientes</h2></div><History /></div>
      <DataTable headers={["Fecha", "Usuario", "Empresa", "Acción", "Entidad", "Descripción"]} rows={rows.map((row) => [new Date(row.created_at).toLocaleString("es-PE"), row.user_name ?? "Sistema", row.company_name ?? "Global", row.action, row.entity, row.description])} />
    </section>
  </div>;
}
