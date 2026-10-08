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
  Library,
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

const navItems = [
  { href: "/books", label: "Bücher", icon: BookOpen },
  { href: "/authors", label: "Autoren", icon: Users },
  { href: "/publishers", label: "Verlage", icon: Building2 },
  { href: "/categories", label: "Kategorien", icon: Tag },
  { href: "/stats", label: "Statistik", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, logoutAll } = useAuth();
  const [confirmAll, setConfirmAll] = useState(false);
  const [logoutAllError, setLogoutAllError] = useState("");

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  async function handleLogoutAll() {
    setLogoutAllError("");
    try {
      await logoutAll();
      setConfirmAll(false);
      router.push("/login");
    } catch {
      setLogoutAllError("Abmelden fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card h-screen sticky top-0 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <Library className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">mr-book</span>
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
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
          onClick={() => {
            setLogoutAllError("");
            setConfirmAll(true);
          }}
        >
          <MonitorOff className="h-4 w-4" />
          Auf allen Geräten abmelden
        </Button>
        <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auf allen Geräten abmelden?</AlertDialogTitle>
              <AlertDialogDescription>
                Du wirst auf allen Geräten abgemeldet, auch auf diesem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {logoutAllError && (
              <p className="text-sm text-destructive">{logoutAllError}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogoutAll}>
                Überall abmelden
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </aside>
  );
}
