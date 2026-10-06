import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusBadgeConfig, type StatusBadgeColor, type StatusTipo } from "./status-badge.config";

const CORES: Record<StatusBadgeColor, string> = {
  gray: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-danger-soft text-destructive",
  blue: "bg-info-soft text-info",
};

/** Etiqueta pequena com a cor de um estado (usada pelo StatusBadge e por selos avulsos). */
export function Selo({ cor = "gray", className, children }: { cor?: StatusBadgeColor; className?: string; children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className={cn("h-5 rounded-md px-1.5 font-medium", CORES[cor], className)}>
      {children}
    </Badge>
  );
}

/** Badge de status do domínio (Pedido / Item / NFe / Chamado) com cor e rótulo padronizados. */
export function StatusBadge({ tipo, valor }: { tipo: StatusTipo; valor: string }) {
  const { label, color } = statusBadgeConfig(tipo, valor);
  return <Selo cor={color}>{label}</Selo>;
}
