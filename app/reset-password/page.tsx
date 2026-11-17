"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError, apiErrorText, authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Library } from "lucide-react";

const INPUT_CLASS =
  "block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50";

// Muss zur Meldung der API passen (app/api/auth/password/reset).
const INVALID_LINK = "Der Link ist ungültig oder abgelaufen.";
const TOO_MANY = "Zu viele Versuche. Bitte versuche es später erneut.";

type Status = "checking" | "form" | "request" | "done";

// Formular zum Anfordern eines neuen Links. Die Antwort ist immer dieselbe,
// egal ob es ein Konto mit der Adresse gibt.
function RequestForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    message: string;
    devResetUrl?: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setDone(await authApi.forgotPassword(email));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(TOO_MANY);
      } else if (err instanceof ApiError && err.status === 400) {
        setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      } else {
        setError(
          "Die Anforderung ist fehlgeschlagen. Bitte versuche es später erneut.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-lg border border-input p-5 text-left text-sm">
        <p>{done.message}</p>
        {done.devResetUrl && (
          <p className="space-y-1">
            <span className="block text-muted-foreground">
              Entwicklungsmodus (noch kein E-Mail-Versand aktiv) — hier
              zurücksetzen:
            </span>
            <a
              href={done.devResetUrl}
              className="block break-all font-medium text-primary underline"
            >
              Passwort zurücksetzen
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-left">
      <p className="text-sm text-muted-foreground">
        Gib die E-Mail-Adresse deines Kontos ein. Wir senden dir einen Link, mit
        dem du ein neues Passwort vergeben kannst.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium">
          E-Mail
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@beispiel.de"
          className={INPUT_CLASS}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
        {loading ? "Wird gesendet..." : "Link anfordern"}
      </Button>
    </form>
  );
}

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { logout } = useAuth();

  // Den Token einmal merken: Die Adresszeile wird nach der Prüfung bereinigt,
  // der Wert muss danach noch im Speicher stehen.
  const [token] = useState(() => params.get("token"));
  const [status, setStatus] = useState<Status>(token ? "checking" : "request");
  const [notice, setNotice] = useState("");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;

    authApi
      .checkResetToken(token)
      .then(() => {
        setStatus("form");
        // Token aus der Adresszeile entfernen (Verlauf, Weitergeben der Adresse).
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 400) {
          setNotice(`${INVALID_LINK} Bitte fordere einen neuen an.`);
        } else if (err instanceof ApiError && err.status === 429) {
          setNotice(TOO_MANY);
        } else {
          setNotice(
            "Der Link konnte nicht geprüft werden. Bitte versuche es später erneut.",
          );
        }
        setStatus("request");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");

    if (password !== passwordConfirm) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    if (password.length < 12) {
      setError("Passwort muss mindestens 12 Zeichen lang sein");
      return;
    }

    setSaving(true);
    try {
      await authApi.resetPassword(token, password);
      // Die API hat alle Sitzungen beendet; den lokalen Zustand angleichen.
      await logout();
      setStatus("done");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(TOO_MANY);
      } else if (err instanceof ApiError && err.status === 400) {
        const text = apiErrorText(err);
        if (text === INVALID_LINK) {
          setNotice(`${INVALID_LINK} Bitte fordere einen neuen an.`);
          setStatus("request");
        } else {
          setError(text ?? "Das Passwort wurde nicht akzeptiert.");
        }
      } else {
        setError(
          err instanceof Error && err.message.startsWith("Keine Verbindung")
            ? err.message
            : "Das Speichern ist fehlgeschlagen. Bitte versuche es später erneut.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <div className="flex justify-center">
            <Library className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Passwort zurücksetzen</h1>
        </div>

        {status === "checking" && (
          <p className="text-muted-foreground">Link wird geprüft…</p>
        )}

        {status === "form" && (
          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">
                Neues Passwort
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="text-xs text-muted-foreground">
                Mindestens 12 Zeichen. Vermeide gängige oder leicht zu erratende
                Passwörter.
              </p>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new-password-confirm"
                className="text-sm font-medium"
              >
                Passwort bestätigen
              </label>
              <input
                id="new-password-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="h-11 w-full text-base"
              disabled={saving}
            >
              {saving ? "Wird gespeichert..." : "Passwort speichern"}
            </Button>
          </form>
        )}

        {status === "request" && (
          <div className="space-y-5">
            {notice && <p className="text-sm text-destructive">{notice}</p>}
            <RequestForm />
          </div>
        )}

        {status === "done" && (
          <p className="text-sm">
            Passwort geändert. Bitte melde dich neu an. Du wirst weitergeleitet…
          </p>
        )}

        <button
          type="button"
          onClick={() => router.push("/login")}
          className="py-1 text-sm text-primary underline"
        >
          Zurück zur Anmeldung
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
