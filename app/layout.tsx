import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "mr-book",
  description: "Persönliche Bücherverwaltung",
};

// Zoom bleibt möglich (kein maximumScale/userScalable). Die App hat nur ein
// helles Thema; colorScheme "light" soll automatisches Umfärben verhindern.
// Die Bildschirmtastatur verkleinert den Inhalt, statt ihn zu überdecken.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <Providers>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
