import { AlertTriangle, BarChartSquare02, Bell01, FileCheck02, FileSearch02, Home01, Package, Settings01, Truck01 } from "@untitledui/icons";
import type { NavItemType } from "@/components/application/app-navigation/config";
import type { PerfilUsuario } from "@/lib/authz";

type ItemMenu = NavItemType & { perfis?: PerfilUsuario[] };

const ITENS: ItemMenu[] = [
  { href: "/", label: "Dashboard", icon: Home01 },
  { href: "/pedidos", label: "Pedidos", icon: Package },
  { href: "/conferencia", label: "Conferência NFe", icon: FileCheck02 },
  { href: "/rastreio", label: "Rastreio", icon: Truck01 },
  { href: "/divergencias", label: "Divergências", icon: AlertTriangle },
  { href: "/pedidos-x-nfe", label: "Pedidos × NFe", icon: BarChartSquare02 },
  { href: "/alertas", label: "Alertas", icon: Bell01 },
  { href: "/auditoria", label: "Auditoria", icon: FileSearch02, perfis: ["ADMIN", "ANALISTA"] },
  { href: "/cadastros", label: "Cadastros", icon: Settings01, perfis: ["ADMIN"] },
];

// Cada perfil vê só o que usa (PRD §4): Cadastros é do ADMIN; Auditoria, de quem monitora.
export function menuDoPerfil(perfil: PerfilUsuario): NavItemType[] {
  return ITENS.filter((item) => !item.perfis || item.perfis.includes(perfil)).map(({ perfis: _perfis, ...item }) => item);
}
