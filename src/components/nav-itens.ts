import { AlertTriangle, BarChartSquare02, Bell01, FileCheck02, Home01, Package, Settings01, Truck01 } from "@untitledui/icons";
import type { NavItemType } from "@/components/application/app-navigation/config";

export const ITENS_MENU: NavItemType[] = [
  { href: "/", label: "Dashboard", icon: Home01 },
  { href: "/pedidos", label: "Pedidos", icon: Package },
  { href: "/conferencia", label: "Conferência NFe", icon: FileCheck02 },
  { href: "/rastreio", label: "Rastreio", icon: Truck01 },
  { href: "/divergencias", label: "Divergências", icon: AlertTriangle },
  { href: "/pedidos-x-nfe", label: "Pedidos × NFe", icon: BarChartSquare02 },
  { href: "/alertas", label: "Alertas", icon: Bell01 },
  { href: "/cadastros", label: "Cadastros", icon: Settings01 },
];
