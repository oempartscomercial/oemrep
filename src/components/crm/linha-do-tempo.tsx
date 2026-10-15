"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Mail, MapPin, MessageCircle, Package, Phone, Search, Sparkles, StickyNote, Users, type LucideIcon } from "lucide-react";
import { agruparPorDia, rotuloDoDia, type CategoriaEvento } from "@/domain/crm/linha-do-tempo";
import { AvatarPessoa } from "@/components/crm/avatar-iniciais";
import { cn } from "@/lib/utils";

export type EventoDaFicha = {
  id: string;
  categoria: CategoriaEvento;
  /** Canal da interação (WHATSAPP, TELEFONE…) ou PEDIDO. */
  canal: string;
  titulo: string;
  descricao: string | null;
  resultado: string | null;
  fabrica: string | null;
  /** "AAAA-MM-DD" no fuso de São Paulo e o instante, para ordenar. */
  dia: string;
  quando: number;
  autor: { quem: string; peloClaude: boolean } | null;
  href?: string;
  selo?: string;
};

const ICONE: Record<string, { icone: LucideIcon; classe: string }> = {
  WHATSAPP: { icone: MessageCircle, classe: "bg-success-soft text-success" },
  TELEFONE: { icone: Phone, classe: "bg-info-soft text-info" },
  EMAIL: { icone: Mail, classe: "bg-[oklch(0.95_0.03_300)] text-[oklch(0.45_0.13_300)]" },
  VISITA: { icone: MapPin, classe: "bg-warning-soft text-warning" },
  REUNIAO: { icone: Users, classe: "bg-warning-soft text-warning" },
  LINKEDIN: { icone: Briefcase, classe: "bg-info-soft text-info" },
  PESQUISA: { icone: Search, classe: "bg-muted text-muted-foreground" },
  OUTRO: { icone: StickyNote, classe: "bg-muted text-muted-foreground" },
  PEDIDO: { icone: Package, classe: "bg-foreground text-background" },
};

const FILTROS: { id: CategoriaEvento | "tudo"; rotulo: string }[] = [
  { id: "tudo", rotulo: "Tudo" },
  { id: "conversa", rotulo: "Contatos" },
  { id: "anotacao", rotulo: "Anotações" },
  { id: "pedido", rotulo: "Pedidos" },
];

/** Linha do tempo da empresa: tudo o que aconteceu, por dia, com filtro por tipo. */
export function LinhaDoTempo({ eventos, hoje }: { eventos: EventoDaFicha[]; hoje: string }) {
  const [filtro, setFiltro] = useState<CategoriaEvento | "tudo">("tudo");
  const contagem = (id: CategoriaEvento | "tudo") => (id === "tudo" ? eventos.length : eventos.filter((e) => e.categoria === id).length);
  const visiveis = filtro === "tudo" ? eventos : eventos.filter((e) => e.categoria === filtro);
  const grupos = agruparPorDia(visiveis);

  return (
    <section aria-labelledby="linha-do-tempo" className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="linha-do-tempo" className="text-sm font-semibold">Linha do tempo</h2>
        <div role="tablist" aria-label="Filtrar a linha do tempo" className="flex gap-1 overflow-x-auto">
          {FILTROS.map((f) => {
            const n = contagem(f.id);
            if (f.id !== "tudo" && n === 0) return null;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors md:h-7",
                  filtro === f.id ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {f.rotulo}
                <span className={cn("tabular", filtro === f.id ? "text-background/70" : "text-muted-foreground/80")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {grupos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ainda não há nada registrado. Use “Registrar contato” para anotar a primeira conversa.</p>
      ) : (
        <div className="flex flex-col px-4 py-2">
          {grupos.map((g) => (
            <div key={g.dia} className="flex flex-col">
              <h3 className="sticky top-0 z-[1] bg-card py-2 text-xs font-semibold text-muted-foreground">{rotuloDoDia(g.dia, hoje)}</h3>
              <ol className="flex flex-col">
                {g.eventos.map((ev, i) => {
                  const { icone: Icone, classe } = ICONE[ev.canal] ?? ICONE.OUTRO;
                  const ultimo = i === g.eventos.length - 1;
                  return (
                    <li key={ev.id} className="relative flex gap-3 pb-4">
                      {!ultimo && <span className="absolute top-9 bottom-0 left-4 w-px bg-border" aria-hidden />}
                      <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-card", classe)}>
                        <Icone className="size-4" aria-hidden />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          {ev.href ? (
                            <Link href={ev.href} className="font-semibold underline-offset-2 hover:underline">{ev.titulo}</Link>
                          ) : (
                            <span className="font-semibold">{ev.titulo}</span>
                          )}
                          {ev.fabrica && <span className="rounded-md bg-info-soft px-1.5 text-xs font-medium text-info">{ev.fabrica}</span>}
                          {ev.selo && <span className="rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground">{ev.selo}</span>}
                        </p>
                        {ev.descricao && <p className="text-sm leading-relaxed text-foreground/85">{ev.descricao}</p>}
                        {ev.resultado && (
                          <p className="text-sm">
                            <span className="font-medium">Resultado:</span> <span className="text-foreground/85">{ev.resultado}</span>
                          </p>
                        )}
                        {ev.autor && (
                          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <AvatarPessoa nome={ev.autor.quem} className={ev.autor.quem === "Importação" || ev.autor.quem === "Automação" ? "bg-muted-foreground/50" : undefined} />
                            {ev.autor.quem}
                            {ev.autor.peloClaude && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.95_0.035_45)] px-1.5 py-px font-medium text-[oklch(0.45_0.12_45)]">
                                <Sparkles className="size-3" aria-hidden />
                                pelo Claude
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
