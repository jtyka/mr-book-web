"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  authApi,
  type UserDto,
  type RegisterResponse,
} from "./api";

interface AuthContextValue {
  user: UserDto | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<RegisterResponse>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Das Session-Cookie ist HttpOnly und clientseitig nicht prüfbar — also
    // immer den Server fragen. 401 heißt schlicht „nicht angemeldet".
    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const data = await authApi.login(email, password, rememberMe);
      setUser(data.user);
    },
    [],
  );

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
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    // Gecachte Daten verwerfen, sonst sähe ein danach im selben Tab
    // angemeldeter Benutzer kurz die Daten des vorherigen.
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const logoutAll = useCallback(async () => {
    // Fehler bewusst NICHT verschlucken: schlägt das Abmelden fehl, soll der
    // Benutzer nicht glauben, er sei überall abgemeldet.
    await authApi.logoutAll();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  return (
    <AuthContext
      value={{ user, loading, login, register, verifyEmail, logout, logoutAll }}
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
