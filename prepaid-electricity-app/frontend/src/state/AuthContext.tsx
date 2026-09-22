import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api, setToken } from "../api/client";

interface User {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: "CUSTOMER" | "ADMIN" | "SUPPORT_AGENT";
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (phoneNumber: string, password: string) => Promise<void>;
  register: (phoneNumber: string, fullName: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("powerpal_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    const result = await api.post<{ token: string; user: User }>("/auth/login", { phoneNumber, password });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (phoneNumber: string, fullName: string, password: string) => {
    const result = await api.post<{ token: string; user: User }>("/auth/register", {
      phoneNumber,
      fullName,
      password,
    });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
