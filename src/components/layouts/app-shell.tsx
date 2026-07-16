"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import { ITENS_MENU } from "@/components/nav-itens";

/**
 * Casca do app: sidebar de navegação (Untitled UI) + área de conteúdo. Responsiva
 * (vira cabeçalho com menu no mobile).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeUrl = pathname === "/" ? "/" : ITENS_MENU.find((i) => i.href !== "/" && pathname.startsWith(i.href!))?.href ?? pathname;

  return (
    <div className="flex min-h-dvh flex-col bg-primary lg:flex-row">
      <SidebarNavigationSimple activeUrl={activeUrl} items={ITENS_MENU} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
