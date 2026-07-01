"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Library } from "lucide-react";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const ran = useRef(false);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
          <div className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
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
