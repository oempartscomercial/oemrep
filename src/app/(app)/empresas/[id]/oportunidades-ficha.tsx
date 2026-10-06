"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Botao } from "@/components/patterns/botao";
import { Selo } from "@/components/patterns/status-badge";
import { DialogoMovimento, type AlvoMovimento } from "@/components/crm/dialogo-movimento";
import { DialogoNovaOportunidade, type FabricaOpcao } from "@/components/crm/dialogo-nova-oportunidade";
import { DialogoContato } from "./ficha-acoes";
import { ETAPAS_DO_QUADRO_OP, etapaAtivaOp, oportunidadeAberta, ROTULO_ETAPA_OP, ROTULO_TIPO_OP, type EtapaOportunidade, type TipoOportunidade } from "@/domain/crm/oportunidade";
import { cn } from "@/lib/utils";

type Oportunidade = {
  id: string;
  fabrica: string;
  tipo: string;
  etapa: string;
  motivoPerda: string | null;
  passoId: string | null;
  passo: { acao: string; quando: string; atrasado: boolean; responsavel: string } | null;
};

const DESTINOS: EtapaOportunidade[] = [...ETAPAS_DO_QUADRO_OP, "ADIADA", "PERDIDA"];
const rotulo = (e: string) => ROTULO_ETAPA_OP[e as EtapaOportunidade] ?? e;

/** Oportunidades da carteira deste cliente (uma por fábrica), com as ações de cada uma. */
export function OportunidadesFicha({
  clienteId,
  nome,
  fabricaIdsQueCompra,
  fabricas,
  responsaveis,
  usuarioId,
  oportunidades,
}: {
  clienteId: string;
  nome: string;
  fabricaIdsQueCompra: string[];
  fabricas: FabricaOpcao[];
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
  oportunidades: Oportunidade[];
}) {
  const router = useRouter();
  const [nova, setNova] = useState(false);
  const [contato, setContato] = useState<Oportunidade | null>(null);
  const [movimento, setMovimento] = useState<AlvoMovimento | null>(null);
  const abertas = oportunidades.filter((o) => oportunidadeAberta(o.etapa));
  const encerradas = oportunidades.filter((o) => !oportunidadeAberta(o.etapa));

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-xs font-medium text-muted-foreground">Oportunidades da carteira</h2>
        <Botao size="xs" variante="ghost" icone={<Plus />} onClick={() => setNova(true)}>
          Nova
        </Botao>
      </div>

      {abertas.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nenhuma oportunidade aberta. Crie uma para oferecer uma fábrica a este cliente.</p>
      ) : (
        <ul className="divide-y">
          {abertas.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Selo cor="blue">{o.fabrica}</Selo>
                <span className="text-sm font-medium">{rotulo(o.etapa)}</span>
                <span className="text-xs text-muted-foreground">{ROTULO_TIPO_OP[o.tipo as TipoOportunidade]}</span>
              </div>
              {o.passo ? (
                <p className="text-sm">
                  {o.passo.acao}
                  <span className={cn("ml-2 text-xs", o.passo.atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {o.passo.quando} · {o.passo.responsavel}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{o.etapa === "A_ABORDAR" ? "Ainda não abordado." : "Sem próximo passo marcado."}</p>
              )}
              <div className="flex gap-2">
                <Botao size="xs" icone={<MessageSquarePlus />} onClick={() => setContato(o)}>
                  Registrar contato
                </Botao>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Botao size="xs">Mover etapa</Botao>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {DESTINOS.filter((d) => d !== o.etapa).map((d) => (
                      <DropdownMenuItem key={d} onSelect={() => setMovimento({ id: o.id, nome: `${nome} · ${o.fabrica}`, de: o.etapa, para: d })}>
                        {rotulo(d)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      {encerradas.length > 0 && (
        <ul className="border-t px-4 py-2 text-xs text-muted-foreground">
          {encerradas.map((o) => (
            <li key={o.id}>
              {o.fabrica}: {rotulo(o.etapa).toLowerCase()}
              {o.motivoPerda ? ` — ${o.motivoPerda}` : ""}
            </li>
          ))}
        </ul>
      )}

      <DialogoNovaOportunidade
        aberto={nova}
        aoFechar={() => setNova(false)}
        clientes={[{ id: clienteId, nome, fabricaIds: fabricaIdsQueCompra }]}
        fabricas={fabricas}
        clienteInicial={clienteId}
      />
      {contato && (
        <DialogoContato
          clienteId={clienteId}
          nome={`${nome} · ${contato.fabrica}`}
          oportunidadeId={contato.id}
          exigePasso={etapaAtivaOp(contato.etapa) && !contato.passoId}
          responsaveis={responsaveis}
          usuarioId={usuarioId}
          aoFechar={() => {
            setContato(null);
            router.refresh();
          }}
        />
      )}
      <DialogoMovimento
        modo="oportunidade"
        alvo={movimento}
        responsaveis={responsaveis}
        usuarioId={usuarioId}
        aoFechar={(movido) => {
          setMovimento(null);
          if (movido) router.refresh();
        }}
      />
    </section>
  );
}
