import { useCallback, useEffect, useState } from "react";
import { apiRequest, deleteRequest, patchJson, postJson } from "./api";

export function useCatalog<T extends { id: number }>(name: string, companyId?: number | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = companyId ? `?company_id=${companyId}` : "";
      setRows(await apiRequest<T[]>(`/api/catalog/${name}${query}`));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : String(currentError));
    } finally {
      setLoading(false);
    }
  }, [name, companyId]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    rows,
    loading,
    error,
    refresh,
    create: async (payload: unknown) => { const result = await postJson(`/api/catalog/${name}`, payload); await refresh(); return result; },
    update: async (id: number, payload: unknown) => { const result = await patchJson(`/api/catalog/${name}/${id}`, payload); await refresh(); return result; },
    remove: async (id: number) => { const result = await deleteRequest(`/api/catalog/${name}/${id}`); await refresh(); return result; },
  };
}
