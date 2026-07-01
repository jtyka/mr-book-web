"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  authApi,
  setAuthToken,
  getAuthToken,
  type UserDto,
  type RegisterResponse,
} from "./api";

interface AuthContextValue {
  user: UserDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<RegisterResponse>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setAuthToken(data.token);
    setUser(data.user);
  }, []);

  // Registrierung meldet NICHT automatisch an — die E-Mail muss erst bestätigt
  // werden. Gibt die (neutrale) Server-Nachricht zurück.
  const register = useCallback(
    async (email: string, password: string, name: string) => {
      return authApi.register(email, password, name);
    },
    [],
  );

  const verifyEmail = useCallback(async (token: string) => {
    const data = await authApi.verify(token);
    setAuthToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext
      value={{ user, loading, login, register, verifyEmail, logout }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
