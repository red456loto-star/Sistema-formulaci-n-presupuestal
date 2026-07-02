import { useCallback, useEffect, useState } from "react";
import { ArchiveRestore, Database, HardDriveDownload, RefreshCw } from "lucide-react";
import { apiRequest } from "../lib/api";

interface DatabaseStatus {
  connected: boolean;
  path: string;
  sizeBytes: number;
  journalMode: string;
  migrationCount: number;
  demoRows: number;
  latestBackup: string | null;
}

export function SystemStatusPage() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await apiRequest<DatabaseStatus>("/api/system/database-status"));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo consultar la base de datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const createBackup = async () => {
    setLoading(true);
    try {
      const result = await apiRequest<{ message: string }>("/api/system/backup", { method: "POST", body: "{}" });
      setMessage(result.message);
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el respaldo.");
      setLoading(false);
    }
  };

  const restoreLatest = async () => {
    const accepted = window.confirm("¿Desea restaurar el respaldo más reciente? La base actual será reemplazada.");
    if (!accepted) return;
    setLoading(true);
    try {
      const result = await apiRequest<{ message: string }>("/api/system/restore-latest", { method: "POST", body: "{}" });
      setMessage(result.message);
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo restaurar el respaldo.");
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Mantenimiento local</span>
          <h1>Estado del sistema</h1>
          <p>Consulta el estado de SQLite y ejecuta operaciones básicas de respaldo y restauración.</p>
        </div>
        <button className="button button--secondary" onClick={() => void loadStatus()} disabled={loading}>
          <RefreshCw size={17} className={loading ? "spin" : ""} /> Actualizar
        </button>
      </section>

      {message && <div className="alert"><span>{message}</span></div>}

      <section className="grid-2">
        <article className="panel">
          <div className="panel__heading">
            <div><span className="eyebrow">SQLite</span><h2>Base de datos local</h2></div>
            <Database size={24} />
          </div>
          <dl className="detail-list">
            <div><dt>Conexión</dt><dd>{status?.connected ? "Activa" : "No disponible"}</dd></div>
            <div><dt>Ruta</dt><dd className="detail-list__path">{status?.path ?? "Consultando..."}</dd></div>
            <div><dt>Tamaño</dt><dd>{status ? `${(status.sizeBytes / 1024).toFixed(2)} KB` : "—"}</dd></div>
            <div><dt>Journal</dt><dd>{status?.journalMode ?? "—"}</dd></div>
            <div><dt>Migraciones</dt><dd>{status?.migrationCount ?? 0}</dd></div>
            <div><dt>Datos demo</dt><dd>{status?.demoRows ?? 0}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel__heading">
            <div><span className="eyebrow">Seguridad de datos</span><h2>Respaldo y restauración</h2></div>
            <HardDriveDownload size={24} />
          </div>
          <p className="muted">Último respaldo: {status?.latestBackup ?? "Todavía no existe un respaldo."}</p>
          <div className="button-row">
            <button className="button button--primary" onClick={createBackup} disabled={loading}>
              <HardDriveDownload size={17} /> Crear respaldo
            </button>
            <button className="button button--secondary" onClick={restoreLatest} disabled={loading || !status?.latestBackup}>
              <ArchiveRestore size={17} /> Restaurar último
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
