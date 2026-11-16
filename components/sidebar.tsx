"use client";

import { Library } from "lucide-react";
import {
  LogoutAllDialog,
  NavLinks,
  UserFooter,
  useLogoutAllDialog,
} from "@/components/nav-parts";

export function Sidebar() {
  const logoutAll = useLogoutAllDialog();

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-card h-dvh sticky top-0 flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <Library className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">mr-book</span>
      </div>
      <NavLinks />
      <UserFooter onLogoutAll={logoutAll.show} />
      <LogoutAllDialog state={logoutAll} />
    </aside>
  );
}
