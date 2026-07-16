import { Badge } from "@/components/ui/badges/badges";
import { statusBadgeConfig, type StatusTipo } from "./status-badge.config";

/**
 * Badge de status do domínio (Pedido / NFe / Chamado) com cor e rótulo padronizados.
 */
export function StatusBadge({ tipo, valor, size = "sm" }: { tipo: StatusTipo; valor: string; size?: "sm" | "md" | "lg" }) {
  const { label, color } = statusBadgeConfig(tipo, valor);
  return (
    <Badge type="pill-color" color={color} size={size}>
      {label}
    </Badge>
  );
}
