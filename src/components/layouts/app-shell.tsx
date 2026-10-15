"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { OemLogo } from "@/components/foundations/logo/oem-logo";
import { menuAgrupado, menuDoPerfil } from "@/components/nav-itens";
import { BuscaGlobalBotao } from "./busca-global";
import { UsuarioRodape, type UsuarioRodapeProps } from "./usuario-rodape";

/**
 * Casca do app: menu lateral compacto (colapsa em cabeçalho no mobile) + conteúdo.
 * Sem usuário, mostra o menu de operador; as telas exibem o aviso de sessão expirada.
 * Os selos de Conversas vêm prontos do layout servidor (em streaming); nulos = sem selo.
 */
export function AppShell({
  children,
  usuario,
  seloConversas = null,
  seloCabecalho = null,
}: {
  children: ReactNode;
  usuario: UsuarioRodapeProps | null;
  seloConversas?: ReactNode;
  seloCabecalho?: ReactNode;
}) {
  const pathname = usePathname();
  const perfil = usuario?.perfil ?? "OPERADOR";
  const itens = menuDoPerfil(perfil);
  // Vale o item de href mais específico (/pedidos/itens, e não /pedidos).
  const ativo =
    pathname === "/"
      ? "/"
      : (itens
          .filter((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)))
          .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="gap-3 px-3 pt-3">
          <OemLogo />
          {usuario && <BuscaGlobalBotao />}
        </SidebarHeader>
        <SidebarContent>
          {menuAgrupado(perfil).map(({ grupo, itens: itensDoGrupo }) => (
            <SidebarGroup key={grupo || "topo"}>
              {grupo && <SidebarGroupLabel>{grupo}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {itensDoGrupo.map((item) => {
                    // Só Conversas leva selo; o menu já esconde o CRM de quem é OPERADOR.
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={item.href === ativo} className="h-11 md:h-8">
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.href === "/conversas" && seloConversas}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        {usuario && (
          <SidebarFooter className="border-t p-2">
            <UsuarioRodape nome={usuario.nome} perfil={usuario.perfil} />
          </SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
          <SidebarTrigger className="size-11 md:size-7" />
          <OemLogo />
          {seloCabecalho}
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
