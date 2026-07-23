import type { NextConfig } from "next";

// NEXT_PUBLIC_API_URL wird hier zur Build-Zeit in die CSP `connect-src`
// eingebacken (Next.js inlined NEXT_PUBLIC_*-Variablen ohnehin beim Build).
// Fehlt sie auf Vercel, würde `connect-src` still auf http://localhost:3000
// zurückfallen und sämtliche API-Calls im Production-Betrieb blockieren — ein Totalausfall,
// der erst zur Laufzeit auffällt. Deshalb bricht der Build hart ab, wenn die
// Variable im echten Vercel-Build fehlt (Vercel setzt `VERCEL=1`).
// Lokale Builds und der Docker-Build laufen ohne VERCEL-Flag und dürfen
// weiterhin auf http://localhost:3000 zurückfallen, auch mit
// NODE_ENV=production.
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL fehlt im Vercel-Build. Ohne diese Variable blockt " +
      "die Content-Security-Policy alle API-Calls zur Laufzeit. Bitte in den " +
      "Vercel-Projekteinstellungen (Environment Variables) setzen.",
  );
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const isDev = process.env.NODE_ENV === "development";

// 'unsafe-inline' für Scripts ist nötig, weil Next.js ohne Nonce-Setup Inline-
// Bootstrap-Scripts einbettet; 'unsafe-eval' braucht nur der Dev-Modus (HMR)
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl}`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
