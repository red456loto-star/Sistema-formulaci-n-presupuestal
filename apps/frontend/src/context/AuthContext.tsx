import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, postJson, setAuthToken, getAuthToken } from "../lib/api";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  companyId: number | null;
  companyName: string | null;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getAuthToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await apiRequest<AuthUser>("/api/auth/me"));
    } catch {
      setAuthToken("");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const onUnauthorized = () => {
      setAuthToken("");
      setUser(null);
    };
    window.addEventListener("presucontrol:unauthorized", onUnauthorized);
    return () => window.removeEventListener("presucontrol:unauthorized", onUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const result = await postJson<{ token: string; user: AuthUser }>("/api/auth/login", { username, password });
    setAuthToken(result.token);
    setUser(result.user);
  };

  const logout = async () => {
    try { await postJson("/api/auth/logout", {}); } catch { /* cierre local de todas formas */ }
    setAuthToken("");
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    logout,
    refresh,
    hasPermission: (permission) => Boolean(user?.roles.includes("ADMINISTRADOR") || user?.permissions.includes(permission)),
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
