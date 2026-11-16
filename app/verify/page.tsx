"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Library } from "lucide-react";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { verifyEmail, resendVerification } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const ran = useRef(false);

  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get("token");
    const run = token
      ? verifyEmail(token)
      : Promise.reject(new Error("no-token"));

    run
      .then(() => {
        setStatus("success");
        setTimeout(() => router.push("/books"), 1200);
      })
      .catch((err) => {
        setStatus("error");
        const msg = err instanceof Error ? err.message : "";
        if (msg === "no-token") {
          setError("Kein Bestätigungs-Token gefunden.");
        } else {
          setError(
            msg.includes("400")
              ? "Der Bestätigungslink ist ungültig oder abgelaufen."
              : "Bestätigung fehlgeschlagen. Bitte versuche es erneut.",
          );
        }
      });
  }, [params, verifyEmail, router]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendError("");
    setResendLoading(true);
    try {
      const res = await resendVerification(resendEmail);
      setResendMessage(res.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429")) {
        setResendError("Zu viele Versuche. Bitte versuche es später erneut.");
      } else if (msg.includes("400")) {
        setResendError("Bitte gib eine gültige E-Mail-Adresse ein.");
      } else {
        setResendError(
          "Der Versand ist fehlgeschlagen. Bitte versuche es später erneut.",
        );
      }
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <Library className="h-10 w-10 text-primary" />
        </div>
        {status === "loading" && (
          <p className="text-muted-foreground">
            E-Mail-Adresse wird bestätigt…
          </p>
        )}
        {status === "success" && (
          <p className="text-sm">
            E-Mail-Adresse bestätigt. Du wirst weitergeleitet…
          </p>
        )}
        {status === "error" && (
          <div className="space-y-6">
            <p className="text-sm text-destructive">{error}</p>

            {resendMessage ? (
              <p className="text-sm">{resendMessage}</p>
            ) : (
              <form
                onSubmit={handleResend}
                className="space-y-3 text-left"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="resend-email"
                    className="text-sm font-medium"
                  >
                    E-Mail
                  </label>
                  <input
                    id="resend-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    className="block w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
                  />
                </div>
                {resendError && (
                  <p className="text-sm text-destructive">{resendError}</p>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  className="h-11 w-full text-base"
                  disabled={resendLoading}
                >
                  {resendLoading
                    ? "Wird gesendet..."
                    : "Bestätigungslink erneut senden"}
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-primary underline"
            >
              Zur Anmeldung
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
