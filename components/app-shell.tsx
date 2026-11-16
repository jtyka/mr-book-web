"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user || pathname === "/login" || pathname === "/verify") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <MobileNav />
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto bg-background p-3 sm:p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
