"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Library } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      router.push("/books");
    } catch {
      setLoginError("E-Mail oder Passwort falsch");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");

    if (regPassword !== regPasswordConfirm) {
      setRegError("Passwörter stimmen nicht überein");
      return;
    }
    if (regPassword.length < 8) {
      setRegError("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    setRegLoading(true);
    try {
      await register(regEmail, regPassword, regName);
      router.push("/books");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registrierung fehlgeschlagen";
      if (msg.includes("409")) {
        setRegError("E-Mail wird bereits verwendet");
      } else {
        setRegError(msg);
      }
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Library className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">mr-book</h1>
          <p className="text-sm text-muted-foreground">
            Deine persönliche Buchverwaltung
          </p>
        </div>

        {/* Tab-Buttons */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors",
              tab === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors",
              tab === "register"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Registrieren
          </button>
        </div>

        {/* Login-Formular */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium">
                E-Mail
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@beispiel.de"
                className="block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-sm font-medium">
                Passwort
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>
            {loginError && (
              <p className="text-sm text-destructive">{loginError}</p>
            )}
            <Button
              type="submit"
              className="h-11 w-full text-base"
              disabled={loginLoading}
            >
              {loginLoading ? "Anmelden..." : "Anmelden"}
            </Button>
          </form>
        )}

        {/* Registrierungs-Formular */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="reg-name"
                required
                autoComplete="name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="text-sm font-medium">
                E-Mail
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="name@beispiel.de"
                className="block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="text-sm font-medium">
                Passwort
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="reg-password-confirm"
                className="text-sm font-medium"
              >
                Passwort bestätigen
              </label>
              <input
                id="reg-password-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={regPasswordConfirm}
                onChange={(e) => setRegPasswordConfirm(e.target.value)}
                className="block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>
            {regError && (
              <p className="text-sm text-destructive">{regError}</p>
            )}
            <Button
              type="submit"
              className="h-11 w-full text-base"
              disabled={regLoading}
            >
              {regLoading ? "Registrieren..." : "Registrieren"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
