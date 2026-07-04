
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "../lib/api";

export interface Company {
  id: number;
  code: string;
  commercial_name: string;
  legal_name: string;
  tax_id: string;
  sector: string;
  currency_id: number;
  active: number;
}

interface WorkspaceContextValue {
  companies: Company[];
  companyId: number | null;
  company: Company | null;
  setCompanyId: (id: number | null) => void;
  refreshCompanies: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = "presucontrol.active.company";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyIdState] = useState<number | null>(() => {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  });

  const refreshCompanies = async () => {
    const rows = await apiRequest<Company[]>("/api/catalog/empresas");
    setCompanies(rows);
    if (!rows.some((item) => item.id === companyId)) {
      setCompanyIdState(rows.find((item) => item.active)?.id ?? rows[0]?.id ?? null);
    }
  };

  useEffect(() => { void refreshCompanies().catch(() => setCompanies([])); }, []);
  useEffect(() => {
    if (companyId) window.localStorage.setItem(STORAGE_KEY, String(companyId));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [companyId]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    companies,
    companyId,
    company: companies.find((item) => item.id === companyId) ?? null,
    setCompanyId: setCompanyIdState,
    refreshCompanies,
  }), [companies, companyId]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider.");
  return value;
}
