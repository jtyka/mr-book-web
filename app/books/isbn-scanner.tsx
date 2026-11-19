"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isValidIsbn, normalizeIsbn } from "@/lib/isbn";

interface IsbnScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (isbn: string) => void;
}

// Minimaler Typ für die (noch nicht in lib.dom enthaltene) BarcodeDetector-API
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const SCAN_INTERVAL_MS = 120; // ca. 8 Bilder pro Sekunde
const MAX_DECODE_WIDTH = 1024;

const MSG_DENIED =
  "Kamerazugriff wurde nicht erlaubt. Bitte in den Browser-Einstellungen freigeben oder die ISBN eintippen.";
const MSG_NO_CAMERA = "Es wurde keine Kamera gefunden. Bitte die ISBN eintippen.";
const MSG_INSECURE =
  "Die Kamera steht nur über eine gesicherte Verbindung (HTTPS) zur Verfügung. Bitte die ISBN eintippen.";
const MSG_BUSY =
  "Die Kamera konnte nicht gestartet werden. Vielleicht wird sie von einer anderen App benutzt. Bitte die ISBN eintippen.";
const MSG_DECODER = "Der Strichcode-Scanner konnte nicht geladen werden. Bitte die ISBN eintippen.";

function cameraErrorMessage(e: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) return MSG_INSECURE;
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return MSG_DENIED;
  if (name === "NotFoundError" || name === "OverconstrainedError") return MSG_NO_CAMERA;
  return MSG_BUSY;
}

// Liefert eine Funktion, die ein Videobild decodiert und den Rohtext oder null zurückgibt.
async function createDecoder(
  video: HTMLVideoElement
): Promise<(() => Promise<string | null>) & { dispose?: () => void }> {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Detector) {
    try {
      const detector = new Detector({ formats: ["ean_13"] });
      return async () => {
        const codes = await detector.detect(video);
        return codes[0]?.rawValue ?? null;
      };
    } catch {
      // Format nicht unterstützt: auf zxing ausweichen
    }
  }
  // Fallback (Safari, Firefox): nur beim ersten Öffnen nachgeladen
  const [browser, lib] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  // EAN13Reader direkt statt MultiFormatReader: der loggt jedes Bild ohne Code
  // als Warnung. TRY_HARDER = feinere Zeilen und auch hochkant gehaltene Codes.
  const hints = new Map<import("@zxing/library").DecodeHintType, unknown>([
    [lib.DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new lib.EAN13Reader();
  const canvas = document.createElement("canvas");
  return async () => {
    if (!video.videoWidth || !video.videoHeight) return null;
    // verkleinern: schont ältere Handys (zxing läuft im Haupt-Thread)
    const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const source = new browser.HTMLCanvasElementLuminanceSource(canvas);
    // Fehler in @zxing/browser 0.2.x: tempCanvasElement startet als undefined statt
    // null, das Drehen (TRY_HARDER, Code hochkant) scheitert sonst bei jedem Bild.
    (source as unknown as { tempCanvasElement: HTMLCanvasElement | null }).tempCanvasElement =
      null;
    const bitmap = new lib.BinaryBitmap(new lib.HybridBinarizer(source));
    try {
      return reader.decode(bitmap, hints).getText();
    } catch {
      return null; // kein Code im Bild
    }
  };
}

export function IsbnScanner({ open, onOpenChange, onDetected }: IsbnScannerProps) {
  // Das Video liegt im Portal und existiert erst nach dem Öffnen: Ref plus Flag
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const setVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setHasVideo(!!node);
  }, []);
  // Callbacks in Refs: Der Elternteil übergibt neue Funktionen pro Render; als
  // Effekt-Abhängigkeit würde die Kamera dabei jedes Mal neu starten.
  const callbacks = useRef({ onDetected, onOpenChange });
  useEffect(() => {
    callbacks.current = { onDetected, onOpenChange };
  });
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!open || !hasVideo || !video) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext ? MSG_NO_CAMERA : MSG_INSECURE);
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        if (!cancelled) {
          setError(cameraErrorMessage(e));
          setStarting(false);
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // autoPlay greift ggf. trotzdem
      }

      let decode: Awaited<ReturnType<typeof createDecoder>>;
      try {
        decode = await createDecoder(video);
      } catch {
        if (!cancelled) {
          setError(MSG_DECODER);
          setStarting(false);
          stop();
        }
        return;
      }
      if (cancelled) return;
      setStarting(false);

      const tick = async () => {
        if (cancelled) return;
        let raw: string | null = null;
        try {
          raw = await decode();
        } catch {
          raw = null;
        }
        if (cancelled) return;
        const code = normalizeIsbn(raw);
        // nur EAN-13 mit gültiger ISBN-Prüfziffer (978/979); Preis-EANs ignorieren
        if (/^97[89]\d{10}$/.test(code) && isValidIsbn(code)) {
          stop();
          callbacks.current.onDetected(code);
          callbacks.current.onOpenChange(false);
          return;
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    })();

    return () => {
      stop();
      // für das nächste Öffnen zurücksetzen
      setError(null);
      setStarting(true);
    };
  }, [open, hasVideo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ISBN scannen</DialogTitle>
          <DialogDescription>Strichcode auf der Rückseite ins Bild halten.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-black">
          <video
            ref={setVideo}
            playsInline
            muted
            autoPlay
            className="size-full object-cover"
            aria-label="Kamerabild"
          />
          {starting && !error && (
            <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white">
              Kamera wird gestartet…
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
        <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
          Abbrechen
        </Button>
      </DialogContent>
    </Dialog>
  );
}
