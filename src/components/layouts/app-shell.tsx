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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { OemLogo } from "@/components/foundations/logo/oem-logo";
import { menuAgrupado, menuDoPerfil } from "@/components/nav-itens";
import { formatarSeloPendencias } from "@/components/nav-pendencias";
import { BuscaGlobalBotao } from "./busca-global";
import { UsuarioRodape, type UsuarioRodapeProps } from "./usuario-rodape";

/**
 * Casca do app: menu lateral compacto (colapsa em cabeçalho no mobile) + conteúdo.
 * Sem usuário, mostra o menu de operador; as telas exibem o aviso de sessão expirada.
 * `pendenciasConversas` vem do layout servidor; nulo (sem CRM ou erro) = sem selo.
 */
export function AppShell({
  children,
  usuario,
  pendenciasConversas = null,
}: {
  children: ReactNode;
  usuario: UsuarioRodapeProps | null;
  pendenciasConversas?: number | null;
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
                    const selo = item.href === "/conversas" ? formatarSeloPendencias(pendenciasConversas) : null;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={item.href === ativo} className="h-11 md:h-8">
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {selo && (
                          <SidebarMenuBadge role="img" aria-label={selo.rotulo}>
                            {selo.texto}
                          </SidebarMenuBadge>
                        )}
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
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
          <SidebarTrigger className="size-11 md:size-7" />
          <OemLogo />
          {(() => {
            const selo = formatarSeloPendencias(pendenciasConversas);
            return selo ? (
              <Link href="/conversas" className="ml-auto inline-flex h-11 items-center rounded-full bg-warning-soft px-3 text-xs font-medium text-warning">
                {selo.rotulo}
              </Link>
            ) : null;
          })()}
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
