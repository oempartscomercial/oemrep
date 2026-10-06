"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import { menuDoPerfil } from "@/components/nav-itens";
import { UsuarioRodape, type UsuarioRodapeProps } from "./usuario-rodape";

/**
 * Casca do app: sidebar de navegação (Untitled UI) + área de conteúdo. Responsiva
 * (vira cabeçalho com menu no mobile). Sem usuário, mostra só o menu de operador e
 * as telas exibem o aviso de sessão expirada.
 */
export function AppShell({ children, usuario }: { children: ReactNode; usuario: UsuarioRodapeProps | null }) {
  const pathname = usePathname();
  const itens = menuDoPerfil(usuario?.perfil ?? "OPERADOR");
  const activeUrl = pathname === "/" ? "/" : itens.filter((i) => i.href !== "/" && pathname.startsWith(i.href!)).sort((a, b) => b.href!.length - a.href!.length)[0]?.href ?? pathname;

  return (
    <div className="flex min-h-dvh flex-col bg-primary lg:flex-row">
      <SidebarNavigationSimple
        activeUrl={activeUrl}
        items={itens}
        featureCard={usuario ? <UsuarioRodape nome={usuario.nome} perfil={usuario.perfil} /> : undefined}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
