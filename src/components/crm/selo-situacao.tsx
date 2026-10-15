import { Selo } from "@/components/patterns/status-badge";
import type { StatusBadgeColor } from "@/components/patterns/status-badge.config";
import { ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";
import { cn } from "@/lib/utils";

const COR: Record<Situacao, StatusBadgeColor> = {
  CANDIDATA: "gray",
  APROVADA: "blue",
  EM_CONTATO: "blue",
  CONVERSANDO: "warning",
  AVANCO: "success",
  PAUSADA: "gray",
  DESCARTADA: "error",
  CLIENTE: "success",
};

/** Cor da bolinha de cada etapa (coluna do funil, selo forte da ficha). */
export const PONTO_DA_ETAPA: Record<string, string> = {
  CANDIDATA: "bg-muted-foreground/50",
  APROVADA: "bg-info/55",
  EM_CONTATO: "bg-info",
  CONVERSANDO: "bg-warning",
  AVANCO: "bg-success",
  PAUSADA: "bg-muted-foreground/40",
  DESCARTADA: "bg-destructive",
  CLIENTE: "bg-success",
  // Carteira
  A_ABORDAR: "bg-muted-foreground/50",
  ABORDADO: "bg-info",
  INTERESSE: "bg-warning",
  COTACAO: "bg-success",
  GANHA: "bg-success",
  ADIADA: "bg-muted-foreground/40",
  PERDIDA: "bg-destructive",
};

export function SeloSituacao({ situacao, forte = false }: { situacao: string; forte?: boolean }) {
  const rotulo = ROTULO_SITUACAO[situacao as Situacao] ?? situacao;
  if (forte) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-semibold shadow-xs">
        <span className={cn("size-2 rounded-full", PONTO_DA_ETAPA[situacao] ?? "bg-muted-foreground")} aria-hidden />
        {rotulo}
      </span>
    );
  }
  return <Selo cor={COR[situacao as Situacao] ?? "gray"}>{rotulo}</Selo>;
}
