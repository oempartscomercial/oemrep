import { CalendarClock } from "lucide-react";
import { descreverPrazo, situacaoDoPrazo, type SituacaoPrazo } from "@/domain/crm/prazo";
import { cn } from "@/lib/utils";

export const COR_DO_PRAZO: Record<SituacaoPrazo, string> = {
  atrasado: "bg-danger-soft text-destructive",
  hoje: "bg-warning-soft text-warning",
  futuro: "bg-info-soft text-info",
};

const ROTULO: Record<SituacaoPrazo, (texto: string) => string> = {
  atrasado: (t) => `Venceu ${t}`,
  hoje: () => "Hoje",
  futuro: (t) => t[0].toUpperCase() + t.slice(1),
};

/** Etiqueta do prazo de um próximo passo: vermelho atrasado, âmbar hoje, azul no futuro. */
export function PrazoSelo({ prazo, hoje, className, icone = false }: { prazo: string; hoje: string; className?: string; icone?: boolean }) {
  const situacao = situacaoDoPrazo(prazo, hoje);
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap", COR_DO_PRAZO[situacao], className)}>
      {icone && <CalendarClock className="size-3" aria-hidden />}
      {ROTULO[situacao](descreverPrazo(prazo, hoje))}
    </span>
  );
}
