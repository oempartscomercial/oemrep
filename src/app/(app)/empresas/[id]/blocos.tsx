import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { UsuarioSessao } from "@/lib/sessao";
import { lerLimites } from "@/lib/whatsapp/despachar";
import { envioAutomaticoLigado } from "@/lib/whatsapp/transporte";
import { envioPeloCelularDaConversa } from "@/domain/mensagens/envio-manual";
import { diaEmSaoPaulo, formatarNumero } from "@/domain/mensagens/exibicao";
import { autoria, categoriaDoCanal } from "@/domain/crm/linha-do-tempo";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";
import { valorDoPedido } from "@/domain/pedido/valor";
import { formatarReais } from "@/domain/formato/moeda";
import { ConversaWhatsapp } from "@/components/crm/conversa-whatsapp";
import { BotaoEscrever, ContatoCartao } from "@/components/crm/contato-acoes";
import { BotaoNovoContato } from "@/components/crm/formulario-contato";
import { LinhaDoTempo, type EventoDaFicha } from "@/components/crm/linha-do-tempo";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { listarResponsaveis } from "../queries";
import { buscarContatos, buscarConversas, buscarHistorico, buscarInteracoes, buscarOportunidades, buscarPedidos, contatosComConversa, listarFabricas } from "./dados";
import { OportunidadesFicha } from "./oportunidades-ficha";

const CARTAO = "rounded-xl border bg-card shadow-xs";
const CANAL: Record<string, string> = { WHATSAPP: "WhatsApp", TELEFONE: "Ligação", EMAIL: "E-mail", VISITA: "Visita", REUNIAO: "Reunião", PESQUISA: "Pesquisa", OUTRO: "Anotação", LINKEDIN: "LinkedIn" };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
type PedidoLista = Awaited<ReturnType<typeof buscarPedidos>>[number];
const valor = (p: PedidoLista) => valorDoPedido({ estado: p.estado, valorTotalDeclarado: p.valorTotalDeclarado, itens: p.itens.map((i) => ({ ...i, quantidadeFaturada: 0, status: "PENDENTE" })) });

type Empresa = { id: string; nome: string; situacao: string; naoContatar: boolean };

export function Bloco({ titulo, acao, id, children, className }: { titulo: React.ReactNode; acao?: React.ReactNode; id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-4", CARTAO, className)}>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="min-w-0 text-sm font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function BlocoCarregando({ linhas = 3, alto = false }: { linhas?: number; alto?: boolean }) {
  return (
    <div className={cn(CARTAO, "flex flex-col gap-3 p-4")} aria-busy="true">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className={cn("h-3.5", alto ? "w-full" : "w-3/4")} />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- WhatsApp: o que espera o Rômulo e as conversas ------------------------------------------

export async function ConversasDaEmpresa({ empresa }: { empresa: Empresa }) {
  const [conversas, limites] = await Promise.all([buscarConversas(empresa.id), lerLimites()]);
  if (conversas.length === 0) return null;
  const envioAutomatico = await envioAutomaticoLigado();
  const agora = new Date();

  // O que espera uma ação do Rômulo: rascunho ou aprovada parada, e resposta do contato sem retorno.
  const precisaDeVoce = conversas.flatMap((c) => {
    const quem = c.contato?.nome ?? c.nomeNoWhatsapp ?? empresa.nome;
    const itens: { chave: string; texto: string }[] = [];
    const rascunhos = c.mensagens.filter((m) => m.direcao === "SAIDA" && m.status === "RASCUNHO").length;
    // Agendada para mais tarde não espera ninguém: sai sozinha na hora marcada.
    const paradas = c.mensagens.filter((m) => m.direcao === "SAIDA" && m.status === "APROVADA" && !(envioAutomatico && m.agendadaPara && m.agendadaPara > agora)).length;
    if (rascunhos > 0) itens.push({ chave: `r-${c.id}`, texto: rascunhos === 1 ? `Um rascunho para ${quem} espera sua aprovação.` : `${rascunhos} rascunhos para ${quem} esperam sua aprovação.` });
    if (paradas > 0) {
      itens.push({
        chave: `p-${c.id}`,
        texto: envioAutomatico ? `Uma mensagem para ${quem} foi aprovada, mas ainda não saiu.` : `Uma mensagem para ${quem} está aprovada: envie pelo celular e toque em "Já enviei".`,
      });
    }
    if (rascunhos === 0 && c.mensagens[0]?.direcao === "ENTRADA") itens.push({ chave: `e-${c.id}`, texto: `${quem} respondeu e espera o seu retorno.` });
    return itens.map((i) => ({ ...i, conversaId: c.id }));
  });

  return (
    <>
      {precisaDeVoce.length > 0 && (
        <section aria-label="Precisa de você" className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3">
          <p className="text-sm font-semibold text-warning">Precisa de você</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {precisaDeVoce.map((i) => (
              <li key={i.chave}>
                <a href={`#conversa-${i.conversaId}`} className="flex min-h-11 items-center underline-offset-2 hover:underline md:min-h-0">{i.texto}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {conversas.map((c) => {
        const quem = c.contato?.nome ?? c.nomeNoWhatsapp ?? empresa.nome;
        const podeResponder = c.contatoId !== null && !c.contato?.naoContatar && !empresa.naoContatar;
        return (
          <Bloco
            key={c.id}
            id={`conversa-${c.id}`}
            titulo={
              <span className="flex min-w-0 items-center gap-2">
                <MessageCircle className="size-4 shrink-0 text-success" aria-hidden />
                <span className="truncate">WhatsApp com {quem}</span>
                <span className="hidden font-normal text-muted-foreground sm:inline">· {formatarNumero(c.numero)}</span>
              </span>
            }
            acao={podeResponder && c.contatoId ? <BotaoEscrever contatoId={c.contatoId} nome={quem} rotulo="Responder" /> : undefined}
          >
            <div className="p-4">
              <ConversaWhatsapp
                destinatario={{ nome: quem, numero: formatarNumero(c.numero) }}
                mensagens={c.mensagens}
                envioAutomatico={envioAutomatico}
                agora={agora}
                envioPeloCelular={envioPeloCelularDaConversa({ numero: c.numero, empresa: { situacao: empresa.situacao, naoContatar: empresa.naoContatar }, contato: c.contato, mensagens: c.mensagens }, limites, agora)}
                aviso={c._count.mensagens > c.mensagens.length ? `Mostrando as ${c.mensagens.length} mensagens mais recentes de ${c._count.mensagens}.` : undefined}
              />
            </div>
          </Bloco>
        );
      })}
    </>
  );
}

// --- Linha do tempo ---------------------------------------------------------------------------

export async function LinhaDoTempoDaEmpresa({ clienteId, usuario }: { clienteId: string; usuario: UsuarioSessao }) {
  const [interacoes, pedidos] = await Promise.all([buscarInteracoes(clienteId), buscarPedidos(clienteId, usuario)]);
  const eventos: EventoDaFicha[] = [
    ...interacoes.map((i) => ({
      id: `i-${i.id}`,
      categoria: categoriaDoCanal(i.canal),
      canal: i.canal,
      titulo: `${CANAL[i.canal] ?? i.canal}${i.comQuem ? ` com ${i.comQuem}` : ""}`,
      descricao: i.resumo || null,
      resultado: i.resultado,
      fabrica: i.oportunidade?.fabrica.nome ?? null,
      dia: diaEmSaoPaulo(i.data),
      quando: i.data.getTime(),
      autor: autoria(i.origem, i.usuario?.nome ?? null),
    })),
    ...pedidos.map((p) => ({
      id: `p-${p.id}`,
      categoria: "pedido" as const,
      canal: "PEDIDO",
      titulo: `Pedido ${p.semNumero ? "S/N" : p.numero} lançado`,
      descricao: `${formatarReais(valor(p))} em ${p.fabrica.nome}`,
      resultado: null,
      fabrica: null,
      dia: diaEmSaoPaulo(p.criadoEm),
      quando: p.criadoEm.getTime(),
      autor: null,
      href: `/pedidos/${p.id}`,
    })),
  ];
  return <LinhaDoTempo eventos={eventos} hoje={hojeEmSaoPaulo()} />;
}

// --- Contatos ---------------------------------------------------------------------------------

export async function ContatosDaEmpresa({ empresa, podeEditar }: { empresa: Empresa; podeEditar: boolean }) {
  const contatos = await buscarContatos(empresa.id);
  const travados = new Set(await contatosComConversa(empresa.id, contatos));
  return (
    <Bloco
      titulo={<>Contatos <span className="font-normal text-muted-foreground tabular">{contatos.length}</span></>}
      acao={podeEditar ? <BotaoNovoContato clienteId={empresa.id} empresa={empresa.nome} /> : undefined}
    >
      {contatos.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum contato com fonte anotada. Cadastre quem a empresa publica como canal comercial.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {contatos.map((c) => (
            <ContatoCartao key={c.id} contato={c} clienteId={empresa.id} empresa={empresa.nome} numeroTravado={travados.has(c.id)} podeEditar={podeEditar} />
          ))}
        </ul>
      )}
    </Bloco>
  );
}

// --- Carteira (só clientes) -------------------------------------------------------------------

export async function CarteiraDaEmpresa({ empresa, fabricaIdsQueCompra, usuarioId }: { empresa: Empresa; fabricaIdsQueCompra: string[]; usuarioId: string }) {
  const [oportunidades, fabricas, responsaveis] = await Promise.all([buscarOportunidades(empresa.id), listarFabricas(), listarResponsaveis()]);
  return (
    <OportunidadesFicha
      clienteId={empresa.id}
      nome={empresa.nome}
      fabricaIdsQueCompra={fabricaIdsQueCompra}
      fabricas={fabricas.filter((f) => f.ativo).map((f) => ({ id: f.id, nome: f.nome }))}
      responsaveis={responsaveis}
      usuarioId={usuarioId}
      hoje={hojeEmSaoPaulo()}
      oportunidades={oportunidades.map((o) => {
        const p = o.proximosPassos[0];
        return {
          id: o.id,
          fabrica: o.fabrica.nome,
          tipo: o.tipo,
          etapa: o.etapa,
          motivoPerda: o.motivoPerda,
          passoId: p?.id ?? null,
          passo: p ? { acao: p.acao, prazo: p.prazo.toISOString().slice(0, 10), responsavel: p.responsavel.nome } : null,
        };
      })}
    />
  );
}

// --- Pedidos ----------------------------------------------------------------------------------

export async function PedidosDaEmpresa({ clienteId, usuario }: { clienteId: string; usuario: UsuarioSessao }) {
  const [pedidos, historico] = await Promise.all([buscarPedidos(clienteId, usuario), buscarHistorico(clienteId, usuario)]);
  const maior = Math.max(1, ...historico.map((h) => h.valor));
  const total = historico.reduce((s, h) => s + h.valor, 0);
  return (
    <>
      <Bloco
        titulo={<>Pedidos no sistema <span className="font-normal text-muted-foreground tabular">{pedidos.length}</span></>}
      >
        {pedidos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum pedido lançado no sistema.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {pedidos.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link href={`/pedidos/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{p.semNumero ? "S/N" : p.numero} <span className="font-normal text-muted-foreground">· {p.fabrica.nome}</span></span>
                    <span className="text-xs text-muted-foreground tabular">
                      {(p.dataPedido ?? p.criadoEm).toLocaleDateString("pt-BR", { timeZone: "UTC" })} ·{" "}
                      {formatarReais(valor(p))}
                    </span>
                  </span>
                  <StatusBadge tipo="pedido" valor={p.estado} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pedidos.length > 6 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Mostrando os 6 mais recentes de {pedidos.length}; todos estão na linha do tempo.</p>}
      </Bloco>

      {historico.length > 0 && (
        <Bloco titulo="Pedidos recebidos (planilha)" acao={<span className="text-sm font-semibold tabular">{formatarReais(total)}</span>}>
          <ul className="flex flex-col gap-3 px-4 py-3">
            {historico.map((h) => (
              <li key={h.fabrica} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {h.fabrica} <span className="font-normal text-muted-foreground">· {plural(h.pedidos, "pedido", "pedidos")}</span>
                  </span>
                  <span className="font-medium tabular">{formatarReais(h.valor)}</span>
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(h.valor / maior) * 100}%` }} />
                </span>
                {h.ultimo && <span className="text-xs text-muted-foreground">Último em {h.ultimo.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>}
              </li>
            ))}
          </ul>
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">Pedidos que chegaram, não faturamento. Linhas suspeitas de duplicidade ficam fora da soma.</p>
        </Bloco>
      )}
    </>
  );
}
