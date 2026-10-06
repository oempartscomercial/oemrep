import { Selo } from "@/components/patterns/status-badge";
import type { StatusBadgeColor } from "@/components/patterns/status-badge.config";
import { ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";

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

export function SeloSituacao({ situacao }: { situacao: string }) {
  return <Selo cor={COR[situacao as Situacao] ?? "gray"}>{ROTULO_SITUACAO[situacao as Situacao] ?? situacao}</Selo>;
}
