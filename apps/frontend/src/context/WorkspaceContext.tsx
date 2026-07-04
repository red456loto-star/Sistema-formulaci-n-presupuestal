import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

export interface BudgetExercise {
  id: number;
  company_id: number;
  code: string;
  budget_year: number;
  start_date: string;
  end_date: string;
  currency_id: number;
  currency_code?: string;
  notes?: string | null;
  active: number;
}

export interface BudgetPeriod {
  id: number;
  company_id: number;
  exercise_id: number;
  period_number: number;
  name: string;
  start_date: string;
  end_date: string;
  status: "ABIERTO" | "CERRADO";
}

export interface BudgetVersion {
  id: number;
  company_id: number;
  exercise_id: number;
  period_id?: number | null;
  code: string;
  name: string;
  version_type: "ORIGINAL" | "FORECAST";
  version_number: number;
  status: "BORRADOR" | "APROBADO" | "CERRADO" | "REEMPLAZADO";
}

interface WorkspaceContextValue {
  companies: Company[];
  companyId: number | null;
  company: Company | null;
  exercises: BudgetExercise[];
  exerciseId: number | null;
  exercise: BudgetExercise | null;
  periods: BudgetPeriod[];
  periodId: number | null;
  period: BudgetPeriod | null;
  versions: BudgetVersion[];
  versionId: number | null;
  version: BudgetVersion | null;
  setCompanyId: (id: number | null) => void;
  setExerciseId: (id: number | null) => void;
  setPeriodId: (id: number | null) => void;
  setVersionId: (id: number | null) => void;
  refreshCompanies: () => Promise<void>;
  refreshExercises: () => Promise<void>;
  refreshPeriods: () => Promise<void>;
  refreshVersions: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const storageKeys = {
  company: "presucontrol.active.company",
  exercise: "presucontrol.active.exercise",
  period: "presucontrol.active.period",
  version: "presucontrol.active.version",
};

function storedId(key: string) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyIdState] = useState<number | null>(() => storedId(storageKeys.company));
  const [exercises, setExercises] = useState<BudgetExercise[]>([]);
  const [exerciseId, setExerciseIdState] = useState<number | null>(() => storedId(storageKeys.exercise));
  const [periods, setPeriods] = useState<BudgetPeriod[]>([]);
  const [periodId, setPeriodIdState] = useState<number | null>(() => storedId(storageKeys.period));
  const [versions, setVersions] = useState<BudgetVersion[]>([]);
  const [versionId, setVersionIdState] = useState<number | null>(() => storedId(storageKeys.version));

  const refreshCompanies = useCallback(async () => {
    const rows = await apiRequest<Company[]>("/api/catalog/empresas");
    setCompanies(rows);
    setCompanyIdState((current) => rows.some((item) => item.id === current && item.active) ? current : (rows.find((item) => item.active)?.id ?? null));
  }, []);

  const refreshExercises = useCallback(async () => {
    if (!companyId) { setExercises([]); setExerciseIdState(null); return; }
    const rows = await apiRequest<BudgetExercise[]>(`/api/catalog/ejercicios?company_id=${companyId}`);
    setExercises(rows);
    setExerciseIdState((current) => rows.some((item) => item.id === current && item.active) ? current : (rows.find((item) => item.active)?.id ?? null));
  }, [companyId]);

  const refreshPeriods = useCallback(async () => {
    if (!companyId || !exerciseId) { setPeriods([]); setPeriodIdState(null); return; }
    const rows = await apiRequest<BudgetPeriod[]>(`/api/catalog/periodos?company_id=${companyId}&exercise_id=${exerciseId}`);
    setPeriods(rows);
    setPeriodIdState((current) => rows.some((item) => item.id === current) ? current : (rows.find((item) => item.status === "ABIERTO")?.id ?? rows[0]?.id ?? null));
  }, [companyId, exerciseId]);

  const refreshVersions = useCallback(async () => {
    if (!companyId || !exerciseId) { setVersions([]); setVersionIdState(null); return; }
    const rows = await apiRequest<BudgetVersion[]>(`/api/catalog/versiones?company_id=${companyId}&exercise_id=${exerciseId}`);
    setVersions(rows);
    setVersionIdState((current) => rows.some((item) => item.id === current) ? current : (rows.find((item) => item.status === "BORRADOR")?.id ?? rows[0]?.id ?? null));
  }, [companyId, exerciseId]);

  useEffect(() => { void refreshCompanies().catch(() => setCompanies([])); }, [refreshCompanies]);
  useEffect(() => { void refreshExercises().catch(() => { setExercises([]); setExerciseIdState(null); }); }, [refreshExercises]);
  useEffect(() => { void refreshPeriods().catch(() => { setPeriods([]); setPeriodIdState(null); }); }, [refreshPeriods]);
  useEffect(() => { void refreshVersions().catch(() => { setVersions([]); setVersionIdState(null); }); }, [refreshVersions]);

  useEffect(() => {
    if (companyId) window.localStorage.setItem(storageKeys.company, String(companyId));
    else window.localStorage.removeItem(storageKeys.company);
  }, [companyId]);
  useEffect(() => {
    if (exerciseId) window.localStorage.setItem(storageKeys.exercise, String(exerciseId));
    else window.localStorage.removeItem(storageKeys.exercise);
  }, [exerciseId]);
  useEffect(() => {
    if (periodId) window.localStorage.setItem(storageKeys.period, String(periodId));
    else window.localStorage.removeItem(storageKeys.period);
  }, [periodId]);
  useEffect(() => {
    if (versionId) window.localStorage.setItem(storageKeys.version, String(versionId));
    else window.localStorage.removeItem(storageKeys.version);
  }, [versionId]);

  const setCompanyId = (id: number | null) => {
    setCompanyIdState(id);
    setExerciseIdState(null);
    setPeriodIdState(null);
    setVersionIdState(null);
  };
  const setExerciseId = (id: number | null) => {
    setExerciseIdState(id);
    setPeriodIdState(null);
    setVersionIdState(null);
  };

  const value = useMemo<WorkspaceContextValue>(() => ({
    companies,
    companyId,
    company: companies.find((item) => item.id === companyId) ?? null,
    exercises,
    exerciseId,
    exercise: exercises.find((item) => item.id === exerciseId) ?? null,
    periods,
    periodId,
    period: periods.find((item) => item.id === periodId) ?? null,
    versions,
    versionId,
    version: versions.find((item) => item.id === versionId) ?? null,
    setCompanyId,
    setExerciseId,
    setPeriodId: setPeriodIdState,
    setVersionId: setVersionIdState,
    refreshCompanies,
    refreshExercises,
    refreshPeriods,
    refreshVersions,
  }), [companies, companyId, exercises, exerciseId, periods, periodId, versions, versionId, refreshCompanies, refreshExercises, refreshPeriods, refreshVersions]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider.");
  return value;
}
