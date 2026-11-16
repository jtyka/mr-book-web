// ============================================================================
// Bild im Browser verkleinern und als JPEG neu kodieren (nur Browser).
// Das Neukodieren über Canvas entfernt alle Metadaten (EXIF, auch Standort) –
// Originaldateien dürfen deshalb nie unverändert durchgereicht werden.
// ============================================================================

export class ImageResizeError extends Error {
  constructor(message = "Bitte ein Bild im Format JPEG, PNG oder WebP wählen.") {
    super(message);
    this.name = "ImageResizeError";
  }
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Obergrenze der API (1 MB); mit etwas Luft darunter bleiben
const MAX_BYTES = 1_000_000;
const MIN_QUALITY = 0.4;

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image": EXIF-Ausrichtung anwenden, damit Handyfotos nicht gedreht sind
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // weiter mit dem Fallback über <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    // Auch ein gültiges, aber sehr großes Foto kann am Speicher scheitern –
    // deshalb nicht nur auf das Format verweisen.
    throw new ImageResizeError(
      "Das Bild konnte nicht gelesen werden. Bitte ein anderes Bild im Format JPEG, PNG oder WebP wählen."
    );
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function resizeImageToJpeg(
  file: File,
  maxEdge = 600,
  quality = 0.85
): Promise<Blob> {
  // Leerer Typ kommt auf manchen Geräten vor – dann entscheidet das Dekodieren.
  if (file.type && !ALLOWED_TYPES.includes(file.type)) throw new ImageResizeError();

  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new ImageResizeError();
    // nie vergrößern
    let scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    let q = quality;

    for (let attempt = 0; attempt < 8; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImageResizeError("Das Bild konnte nicht verarbeitet werden.");
      // JPEG kennt keine Transparenz – sonst würden PNG-Flächen schwarz
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);

      const blob = await toJpeg(canvas, q);
      if (!blob) throw new ImageResizeError("Das Bild konnte nicht verarbeitet werden.");
      if (blob.size <= MAX_BYTES) return blob;

      // zu groß: erst Qualität schrittweise senken, dann zusätzlich verkleinern
      if (q > MIN_QUALITY) q = Math.max(MIN_QUALITY, q - 0.15);
      else scale *= 0.8;
    }
    throw new ImageResizeError("Das Bild ist zu groß und konnte nicht verkleinert werden.");
  } finally {
    img.release();
  }
}
