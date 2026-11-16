"use client";

import { useState } from "react";
import { ImageOff, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookCoverProps {
  url: string | null | undefined;
  size: "sm" | "lg";
  alt: string;
  className?: string;
}

// Feste Größe im Seitenverhältnis 2:3 – Bild und Platzhalter sind gleich groß,
// damit Listenzeilen nicht springen.
const SIZES = {
  sm: { w: 40, h: 60, box: "h-[60px] w-[40px]", icon: "h-4 w-4" },
  lg: { w: 120, h: 180, box: "h-[180px] w-[120px]", icon: "h-8 w-8" },
} as const;

export function BookCover({ url, size, alt, className }: BookCoverProps) {
  // Adresse, die nicht geladen werden konnte; bei neuer Adresse greift sie nicht mehr
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const dim = SIZES[size];
  const base = cn("shrink-0 rounded-md", dim.box, className);

  if (!url || failedUrl === url) {
    const Icon = url ? ImageOff : BookOpen;
    return (
      <div
        className={cn(base, "flex items-center justify-center bg-muted text-muted-foreground")}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <Icon className={dim.icon} />
      </div>
    );
  }

  return (
    // Bewusst <img> statt next/image: die Bildoptimierung hat eigene Kontingente
    // und bringt bei den ohnehin kleinen Cover-Dateien nichts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={dim.w}
      height={dim.h}
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(url)}
      className={cn(base, "bg-muted object-cover")}
    />
  );
}
