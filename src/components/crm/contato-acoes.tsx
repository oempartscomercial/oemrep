"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Briefcase, Building2, Mail, MessageCircle, MoreHorizontal, Pencil, Phone, RotateCcw, StickyNote, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoTexto } from "@/components/patterns/campo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormularioContato, type ContatoParaEditar } from "@/components/crm/formulario-contato";
import { ehCanalTelefone } from "@/domain/crm/contato";
import { normalizarTelefone } from "@/domain/mensagens/telefone";
import { iniciais } from "@/domain/formato/nome";
import { cn } from "@/lib/utils";
import { ComporMensagem } from "@/components/crm/compor-mensagem";
import { definirOrigemContato, marcarNaoContatar, reativarContato } from "@/app/(app)/conversas/actions";

const ORIGENS = [
  { id: "PUBLICADO_PELA_EMPRESA", label: "Publicado pela empresa" },
  { id: "INDICACAO", label: "Indicação" },
  { id: "BASE_PROFISSIONAL", label: "Base profissional" },
  { id: "RELACIONAMENTO", label: "Já tínhamos relação" },
];

const ICONE_CANAL: Record<string, LucideIcon> = { WHATSAPP: MessageCircle, TELEFONE: Phone, EMAIL: Mail, LINKEDIN: Briefcase };
const NOME_CANAL: Record<string, string> = { WHATSAPP: "WhatsApp", TELEFONE: "Telefone", EMAIL: "E-mail", LINKEDIN: "LinkedIn", OUTRO: "Outro" };

export type ContatoDaFicha = ContatoParaEditar & { naoContatar: boolean; origemContato: string | null };

/** Link de discar ou de escrever e-mail para o valor do contato (só o que é seguro montar). */
function linkDoValor(canal: string, valor: string): string | null {
  if (canal === "EMAIL" && valor.includes("@")) return `mailto:${valor}`;
  if (ehCanalTelefone(canal)) {
    const digitos = valor.replace(/\D/g, "");
    return digitos.length >= 10 ? `tel:+55${digitos.slice(-11)}` : null;
  }
  return null;
}

/**
 * Cartão compacto de um contato na ficha: quem é, por onde falar e de onde veio o número.
 * As ações ficam num botão de WhatsApp e num menu ⋯ (origem, editar, não contatar).
 * Sem origem registrada nada é enviado (ADR-015): o cartão avisa e o menu resolve.
 */
export function ContatoCartao({
  contato,
  clienteId,
  empresa,
  numeroTravado,
  podeEditar,
}: {
  contato: ContatoDaFicha;
  clienteId: string;
  empresa: string;
  numeroTravado: boolean;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [escrevendo, setEscrevendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupadoNaoContatar, setOcupadoNaoContatar] = useState(false);
  const [erroNaoContatar, setErroNaoContatar] = useState<string | null>(null);

  const nome = contato.nome ?? empresa;
  const telefone = normalizarTelefone(contato.valor) !== null && (contato.canal === "WHATSAPP" || contato.canal === "TELEFONE");
  const podeEscrever = telefone && !contato.naoContatar;
  const Icone = ICONE_CANAL[contato.canal] ?? StickyNote;
  const link = linkDoValor(contato.canal, contato.valor);
  const origem = ORIGENS.find((o) => o.id === contato.origemContato)?.label ?? null;

  async function mudarOrigem(valor: string) {
    const r = await definirOrigemContato({ contatoId: contato.id, origem: valor });
    setErro(r.erros[0] ?? null);
    router.refresh();
  }
  async function reativar() {
    const r = await reativarContato({ contatoId: contato.id });
    setErro(r.erros[0] ?? null);
    router.refresh();
  }
  function fecharNaoContatar() {
    setMarcando(false);
    setMotivo("");
    setErroNaoContatar(null);
  }
  async function confirmarNaoContatar() {
    setOcupadoNaoContatar(true);
    setErroNaoContatar(null);
    try {
      const r = await marcarNaoContatar({ contatoId: contato.id, motivo });
      if (r.erros.length > 0) {
        setErroNaoContatar(r.erros[0]);
        return;
      }
      fecharNaoContatar();
      router.refresh();
    } catch {
      setErroNaoContatar("Não foi possível marcar agora. Tente de novo.");
    } finally {
      setOcupadoNaoContatar(false);
    }
  }

  return (
    <li className={cn("flex flex-col gap-1.5 px-4 py-3", contato.naoContatar && "bg-danger-soft/40")}>
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", contato.nome ? "bg-muted text-foreground" : "bg-ink-soft text-muted-foreground")}>
          {contato.nome ? <span className="text-xs font-semibold">{iniciais(contato.nome)}</span> : <Building2 className="size-4" aria-hidden />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-semibold">
            {contato.nome ?? "Canal da empresa"}
            {contato.funcao && <span className="font-normal text-muted-foreground"> · {contato.funcao}</span>}
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-sm">
            <Icone className="size-3.5 shrink-0 text-muted-foreground" aria-label={NOME_CANAL[contato.canal] ?? contato.canal} />
            {link ? (
              <a href={link} className="truncate underline-offset-2 hover:underline">{contato.valor}</a>
            ) : (
              <span className="truncate">{contato.valor}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {podeEscrever && (
            <button
              type="button"
              onClick={() => setEscrevendo(true)}
              aria-label={`Escrever no WhatsApp para ${nome}`}
              title="Escrever no WhatsApp"
              className="grid size-11 place-items-center rounded-md text-success hover:bg-success-soft md:size-8"
            >
              <MessageCircle className="size-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Ações de ${nome}`} className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:size-8">
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {telefone && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">De onde veio o número</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={contato.origemContato ?? ""} onValueChange={mudarOrigem}>
                    {ORIGENS.map((o) => (
                      <DropdownMenuRadioItem key={o.id} value={o.id}>{o.label}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              {podeEditar && (
                <DropdownMenuItem onSelect={() => setEditando(true)}>
                  <Pencil /> Editar contato
                </DropdownMenuItem>
              )}
              {contato.naoContatar ? (
                <DropdownMenuItem onSelect={reativar}>
                  <RotateCcw /> Reativar contato
                </DropdownMenuItem>
              ) : (
                telefone && (
                  <DropdownMenuItem variant="destructive" onSelect={() => setMarcando(true)}>
                    <Ban /> Não contatar
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-[2.625rem] text-xs">
        {contato.naoContatar && <span className="rounded-md bg-danger-soft px-1.5 py-px font-medium text-destructive">Não contatar</span>}
        {telefone && !origem && !contato.naoContatar && <span className="rounded-md bg-warning-soft px-1.5 py-px font-medium text-warning">Sem origem do número: defina no menu ⋯</span>}
        {origem && <span className="rounded-md bg-muted px-1.5 py-px text-muted-foreground">{origem}</span>}
        <span className="min-w-0 truncate text-muted-foreground" title={contato.fonte}>Fonte: {contato.fonte}</span>
      </div>
      {erro && <p className="pl-[2.625rem] text-xs text-destructive">{erro}</p>}

      {escrevendo && <ComporMensagem contatoId={contato.id} nome={nome} aoFechar={() => setEscrevendo(false)} />}
      {editando && <FormularioContato clienteId={clienteId} empresa={empresa} contato={contato} numeroTravado={numeroTravado} aoFechar={() => setEditando(false)} />}
      {marcando && (
        <Dialog open onOpenChange={(aberto) => !aberto && fecharNaoContatar()}>
          <DialogContent className="sm:max-w-md max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Não contatar</DialogTitle>
              <DialogDescription>
                Marcar {nome} como &apos;não contatar&apos;? As mensagens pendentes serão canceladas e nada mais será enviado para este contato. Só uma pessoa pode desfazer.
              </DialogDescription>
            </DialogHeader>
            <CampoTexto
              rotulo="Motivo (opcional)"
              placeholder="Ex.: pediu por WhatsApp para parar"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
            />
            {erroNaoContatar && <p className="text-sm text-destructive">{erroNaoContatar}</p>}
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={fecharNaoContatar}>Cancelar</Botao>
              <Botao variante="primario" className="h-11 md:h-8" carregando={ocupadoNaoContatar} onClick={confirmarNaoContatar}>
                Confirmar
              </Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}

/** Botão avulso para abrir o compositor (listas fora da ficha). */
export function BotaoEscrever({ contatoId, nome, rotulo }: { contatoId: string; nome: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao size="xs" className="h-11 md:h-6" icone={<MessageCircle />} onClick={() => setAberto(true)}>{rotulo}</Botao>
      {aberto && <ComporMensagem contatoId={contatoId} nome={nome} aoFechar={() => setAberto(false)} />}
    </>
  );
}
