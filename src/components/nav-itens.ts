import { AlertTriangle, BarChart3, Bell, FileCheck2, FileSearch, House, ListChecks, Package, Settings, Truck, type LucideIcon } from "lucide-react";
import type { PerfilUsuario } from "@/lib/authz";

export type NavItem = { href: string; label: string; icon: LucideIcon; grupo: string };

// A ordem aqui é a ordem do menu; os itens de um mesmo grupo são contíguos.
const ITENS: NavItem[] = [
  { href: "/", label: "Início", icon: House, grupo: "" },
  { href: "/pedidos", label: "Pedidos", icon: Package, grupo: "Pedidos" },
  { href: "/pedidos/itens", label: "Itens pendentes", icon: ListChecks, grupo: "Pedidos" },
  { href: "/conferencia", label: "Conferência NFe", icon: FileCheck2, grupo: "Pedidos" },
  { href: "/rastreio", label: "Rastreio", icon: Truck, grupo: "Pedidos" },
  { href: "/divergencias", label: "Divergências", icon: AlertTriangle, grupo: "Pedidos" },
  { href: "/pedidos-x-nfe", label: "Pedidos × NFe", icon: BarChart3, grupo: "Análise" },
  { href: "/alertas", label: "Alertas", icon: Bell, grupo: "Análise" },
  { href: "/auditoria", label: "Auditoria", icon: FileSearch, grupo: "Administração" },
  { href: "/cadastros", label: "Cadastros", icon: Settings, grupo: "Administração" },
];

// Rotas restritas; as demais são de todos os perfis.
const PERFIS_DA_ROTA: Record<string, PerfilUsuario[]> = {
  "/auditoria": ["ADMIN", "ANALISTA"],
  "/cadastros": ["ADMIN"],
};

// Cada perfil vê só o que usa (PRD §4): Cadastros é do ADMIN; Auditoria, de quem monitora.
export function menuDoPerfil(perfil: PerfilUsuario): NavItem[] {
  return ITENS.filter((item) => PERFIS_DA_ROTA[item.href]?.includes(perfil) ?? true);
}

export function menuAgrupado(perfil: PerfilUsuario): { grupo: string; itens: NavItem[] }[] {
  const grupos: { grupo: string; itens: NavItem[] }[] = [];
  for (const item of menuDoPerfil(perfil)) {
    const atual = grupos[grupos.length - 1];
    if (atual && atual.grupo === item.grupo) atual.itens.push(item);
    else grupos.push({ grupo: item.grupo, itens: [item] });
  }
  return grupos;
}
