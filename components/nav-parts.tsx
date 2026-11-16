"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  Building2,
  Tag,
  BarChart3,
  LogOut,
  MonitorOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Gemeinsame Bausteine von Sidebar (ab md) und Drawer (darunter).

const navItems = [
  { href: "/books", label: "Bücher", icon: BookOpen },
  { href: "/authors", label: "Autoren", icon: Users },
  { href: "/publishers", label: "Verlage", icon: Building2 },
  { href: "/categories", label: "Kategorien", icon: Tag },
  { href: "/stats", label: "Statistik", icon: BarChart3 },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 py-4">
      <ul className="space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function UserFooter({
  onLogoutAll,
  onNavigate,
}: {
  // öffnet den Bestätigungsdialog, der vom Aufrufer außerhalb des (ggf.
  // schließenden) Containers gerendert wird
  onLogoutAll: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    onNavigate?.();
    router.push("/login");
  }

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="text-sm font-medium truncate">{user?.name}</div>
      <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start gap-2 text-muted-foreground"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        Abmelden
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground"
        onClick={onLogoutAll}
      >
        <MonitorOff className="h-4 w-4" />
        Auf allen Geräten abmelden
      </Button>
    </div>
  );
}

// Zustand für „Auf allen Geräten abmelden"; der Dialog selbst muss vom
// Aufrufer außerhalb des Drawers gerendert werden.
export function useLogoutAllDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return {
    open,
    error,
    show() {
      setError("");
      setOpen(true);
    },
    setOpen,
    setError,
  };
}

export function LogoutAllDialog({
  state,
}: {
  state: ReturnType<typeof useLogoutAllDialog>;
}) {
  const router = useRouter();
  const { logoutAll } = useAuth();

  async function handleLogoutAll() {
    state.setError("");
    try {
      await logoutAll();
      state.setOpen(false);
      router.push("/login");
    } catch {
      state.setError("Abmelden fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  return (
    <AlertDialog open={state.open} onOpenChange={state.setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Auf allen Geräten abmelden?</AlertDialogTitle>
          <AlertDialogDescription>
            Du wirst auf allen Geräten abgemeldet, auch auf diesem.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogoutAll}>
            Überall abmelden
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
