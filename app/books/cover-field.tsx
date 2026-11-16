"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { ImageResizeError, resizeImageToJpeg } from "@/lib/image-resize";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Cover-Zustand im Formular – wirksam wird er erst beim Speichern.
export type CoverState =
  | { kind: "unchanged" }
  | { kind: "file"; blob: Blob; previewUrl: string }
  | { kind: "lookup"; sourceUrl: string }
  | { kind: "remove" };

export const COVER_UNCHANGED: CoverState = { kind: "unchanged" };

const MSG_BAD_IMAGE = "Bitte ein Bild im Format JPEG, PNG oder WebP wählen.";

// Verständliche Meldung für einen fehlgeschlagenen Cover-Aufruf; `detail` ist
// der Zusatz zur Grundmeldung (null = nur die Grundmeldung).
// `fromLookup`: der Aufruf war die Übernahme einer Lookup-Adresse, kein Upload.
export function coverErrorDetail(e: unknown, fromLookup = false): string | null {
  if (e instanceof ApiError) {
    if (e.status === 503) return "Der Bildspeicher ist nicht eingerichtet.";
    if (e.status === 404) return "Für dieses Buch wurde kein Cover gefunden.";
    if (e.status === 400 && fromLookup) {
      return "Das Cover aus dem Lookup konnte nicht übernommen werden.";
    }
    if (e.status === 400 || e.status === 413) return MSG_BAD_IMAGE;
    if (e.status === 502) {
      return "Das Cover konnte nicht gespeichert werden. Bitte später erneut versuchen.";
    }
    if (e.status === 429) {
      return e.retryAfter
        ? `Zu viele Anfragen. Bitte in ${e.retryAfter} Sekunden erneut versuchen.`
        : "Zu viele Anfragen. Bitte gleich noch einmal versuchen.";
    }
  }
  return null;
}

interface CoverFieldProps {
  // aktuell gespeichertes Cover des Buchs (null bei neuem Buch / ohne Cover)
  currentUrl: string | null;
  value: CoverState;
  onChange: (next: CoverState) => void;
  // Hinweis, z. B. nach dem Wiederherstellen eines Entwurfs
  notice?: string | null;
  disabled?: boolean;
}

export function CoverField({ currentUrl, value, onChange, notice, disabled }: CoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object-URL der Vorschau freigeben, sobald sie ersetzt wird oder das Feld
  // verschwindet.
  const previewUrl = value.kind === "file" ? value.previewUrl : null;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await resizeImageToJpeg(file);
      onChange({ kind: "file", blob, previewUrl: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof ImageResizeError ? err.message : MSG_BAD_IMAGE);
    } finally {
      setBusy(false);
    }
  }

  // Eine noch nicht gespeicherte Auswahl (Foto, Lookup) oder ein vorgemerktes
  // Entfernen wird nur verworfen – das gespeicherte Cover bleibt. Erst ohne
  // offene Auswahl bedeutet der Button „gespeichertes Cover löschen".
  const pending = value.kind !== "unchanged";
  function handleRemove() {
    setError(null);
    onChange(pending ? COVER_UNCHANGED : { kind: "remove" });
  }

  const shownUrl =
    value.kind === "file" ? value.previewUrl : value.kind === "unchanged" ? currentUrl : null;
  const showSecondButton = pending || currentUrl != null;
  const secondLabel =
    value.kind === "remove" ? "Doch behalten" : pending ? "Auswahl verwerfen" : "Entfernen";

  return (
    <div className="sm:col-span-2 space-y-1">
      <Label>Cover</Label>
      <div className="flex items-start gap-4">
        <BookCover url={shownUrl} size="lg" alt="Cover" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || disabled}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus />
              {busy ? "Verarbeite…" : "Bild wählen"}
            </Button>
            {showSecondButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || disabled}
                onClick={handleRemove}
              >
                <Trash2 />
                {secondLabel}
              </Button>
            )}
          </div>
          {/* kein capture-Attribut: so bietet das Handy Kamera und Galerie an */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handleFile}
          />
          {value.kind === "lookup" && (
            <p className="text-muted-foreground text-xs">
              Cover aus dem Lookup wird beim Speichern übernommen.
            </p>
          )}
          {value.kind === "file" && (
            <p className="text-muted-foreground text-xs">
              Das Bild wird beim Speichern übernommen.
            </p>
          )}
          {value.kind === "remove" && (
            <p className="text-muted-foreground text-xs">
              Das Cover wird beim Speichern entfernt.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
          {!error && notice && <p className="text-muted-foreground text-xs">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
