"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Library, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LogoutAllDialog,
  NavLinks,
  UserFooter,
  useLogoutAllDialog,
} from "@/components/nav-parts";

// Kopfzeile + Drawer für Breiten unter md; ab md übernimmt die Sidebar.
export function MobileNav() {
  const pathname = usePathname();
  // Der Drawer gilt nur für die Route, auf der er geöffnet wurde – so schließt
  // er bei jedem Routenwechsel, ohne Effekt.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  // Nach einem Routenwechsel den gemerkten Pfad verwerfen, sonst ginge der
  // Drawer bei Browser-Zurück/Vor auf die alte Route von selbst wieder auf.
  if (openedAt !== null && openedAt !== pathname) setOpenedAt(null);
  const open = openedAt === pathname;
  const logoutAll = useLogoutAllDialog();

  const close = () => setOpenedAt(null);

  // Der Drawer liegt in einem Portal, `md:hidden` an der Kopfzeile erreicht
  // ihn nicht: Wird es breit genug für die Sidebar (z. B. Drehen ins
  // Querformat), den Drawer schließen.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpenedAt(null);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        aria-label="Menü öffnen"
        onClick={() => setOpenedAt(pathname)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Library className="h-5 w-5 text-primary" />
      <span className="font-semibold text-lg">mr-book</span>

      <Sheet open={open} onOpenChange={(o) => (o ? setOpenedAt(pathname) : close())}>
        <SheetContent side="left" className="gap-0 p-0">
          <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
            <Library className="h-6 w-6 text-primary" />
            <SheetTitle className="text-lg font-semibold">mr-book</SheetTitle>
            <SheetDescription className="sr-only">Navigation</SheetDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <NavLinks onNavigate={close} />
            <UserFooter
              onNavigate={close}
              onLogoutAll={() => {
                close();
                logoutAll.show();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* außerhalb des Drawers, damit er beim Schließen nicht mit unmountet */}
      <LogoutAllDialog state={logoutAll} />
    </header>
  );
}
