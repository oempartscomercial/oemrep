import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin, Pencil } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarFicha, listarResponsaveis } from "../queries";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layouts/page-container";
import { Botao } from "@/components/patterns/botao";
import { Selo, StatusBadge } from "@/components/patterns/status-badge";
import { Timeline, type TimelineItem } from "@/components/patterns/timeline";
import { SeloSituacao } from "@/components/crm/selo-situacao";
import { ConversaWhatsapp } from "@/components/crm/conversa-whatsapp";
import { formatarNumero } from "@/domain/mensagens/exibicao";
import { normalizarTelefone } from "@/domain/mensagens/telefone";
import { ContatoAcoes } from "@/components/crm/contato-acoes";
import { BotaoEditarContato, BotaoNovoContato } from "@/components/crm/formulario-contato";
import { descreverPrazo, formatarDia, hojeEmSaoPaulo, situacaoDoPrazo } from "@/domain/crm/prazo";
import { cn } from "@/lib/utils";
import { podeVerCrm } from "@/lib/authz";
import { FichaAcoes } from "./ficha-acoes";
import { OportunidadesFicha } from "./oportunidades-ficha";
import { RecolhivelNoCelular } from "@/components/crm/recolhivel-no-celular";

const CANAL: Record<string, string> = { WHATSAPP: "WhatsApp", TELEFONE: "Ligação", EMAIL: "E-mail", VISITA: "Visita", REUNIAO: "Reunião", PESQUISA: "Pesquisa", OUTRO: "Anotação", LINKEDIN: "LinkedIn" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Bloco({ titulo, acao, id, children }: { titulo: string; acao?: React.ReactNode; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-medium text-muted-foreground">{titulo}</h2>
        {acao}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null; // o layout do CRM já mostra a sessão expirada
  const [ficha, responsaveis, fabricasAtivas] = await Promise.all([
    buscarFicha(id, usuario),
    listarResponsaveis(),
    prisma.fabrica.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!ficha) notFound();
  const { empresa, historico, contatosComConversa } = ficha;
  const podeEditarContatos = podeVerCrm(usuario);
  const hoje = hojeEmSaoPaulo();
  const passo = empresa.proximosPassos.find((p) => !p.oportunidadeId) ?? null;
  const prazo = passo?.prazo.toISOString().slice(0, 10);
  const atrasado = prazo ? situacaoDoPrazo(prazo, hoje) === "atrasado" : false;

  // O que espera uma ação do Rômulo: rascunho ou aprovada parada, e resposta do contato sem retorno.
  const precisaDeVoce = empresa.conversas.flatMap((c) => {
    const quem = c.contato?.nome ?? c.nomeNoWhatsapp ?? empresa.nomeFantasia;
    const itens: { chave: string; texto: string }[] = [];
    const rascunhos = c.mensagens.filter((m) => m.direcao === "SAIDA" && m.status === "RASCUNHO").length;
    const paradas = c.mensagens.filter((m) => m.direcao === "SAIDA" && m.status === "APROVADA").length;
    if (rascunhos > 0) itens.push({ chave: `r-${c.id}`, texto: rascunhos === 1 ? `Um rascunho para ${quem} espera sua aprovação.` : `${rascunhos} rascunhos para ${quem} esperam sua aprovação.` });
    if (paradas > 0) itens.push({ chave: `p-${c.id}`, texto: `Uma mensagem para ${quem} foi aprovada, mas ainda não saiu.` });
    if (rascunhos === 0 && c.mensagens[0]?.direcao === "ENTRADA") itens.push({ chave: `e-${c.id}`, texto: `${quem} respondeu e espera o seu retorno.` });
    return itens.map((i) => ({ ...i, conversaId: c.id }));
  });

  const eventos: (TimelineItem & { quando: number })[] = [
    ...empresa.interacoes.map((i) => ({
      id: `i-${i.id}`,
      quando: i.data.getTime(),
      titulo: `${CANAL[i.canal] ?? i.canal}${i.comQuem ? ` · ${i.comQuem}` : ""}${i.oportunidade ? ` · ${i.oportunidade.fabrica.nome}` : ""}`,
      descricao: [i.resumo, i.resultado && `Resultado: ${i.resultado}`].filter(Boolean).join(" — "),
      data: i.data.toLocaleDateString("pt-BR"),
      autor: i.origem === "USUARIO" ? i.usuario?.nome : i.origem === "AUTOMACAO" ? "automação" : "importação",
    })),
    ...empresa.pedidos.map((p) => ({
      id: `p-${p.id}`,
      quando: p.criadoEm.getTime(),
      titulo: `Pedido ${p.semNumero ? "S/N" : p.numero} lançado`,
      descricao: p.fabrica.nome,
      data: p.criadoEm.toLocaleDateString("pt-BR"),
    })),
  ].sort((a, b) => b.quando - a.quando);

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{empresa.nomeFantasia}</h1>
            <SeloSituacao situacao={empresa.situacao} />
            {empresa.naoContatar && <Selo cor="error">Não contatar</Selo>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {(empresa.cidade || empresa.uf) && (
              <span className="flex items-center gap-1"><MapPin className="size-3.5" />{[empresa.cidade, empresa.uf].filter(Boolean).join("/")}</span>
            )}
            {empresa.site && (
              <span className="flex min-w-0 items-center gap-1 break-all"><Globe className="size-3.5" />{empresa.site}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {usuario.perfil === "ADMIN" && (
            <Botao variante="ghost" className="h-11 md:h-8" icone={<Pencil />} href={`/cadastros/clientes/${empresa.id}`}>Editar cadastro</Botao>
          )}
        </div>
      </div>

      {precisaDeVoce.length > 0 && (
        <section aria-label="Precisa de você" className="rounded-lg border border-warning/50 bg-warning-soft px-4 py-3">
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

      <FichaAcoes
        destaque={precisaDeVoce.length === 0}
        clienteId={empresa.id}
        nome={empresa.nomeFantasia}
        situacao={empresa.situacao}
        passoAbertoId={passo?.id ?? null}
        responsaveis={responsaveis}
        usuarioId={usuario.id}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <section className={cn("rounded-lg border bg-card px-4 py-3", atrasado && "border-destructive/40 bg-danger-soft")}>
            <p className="text-xs font-medium text-muted-foreground">Próximo passo</p>
            {passo && prazo ? (
              <p className="mt-1 text-sm">
                <span className="font-medium">{passo.acao}</span>
                <span className={cn("ml-2", atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {descreverPrazo(prazo, hoje)} · {formatarDia(prazo)} · {passo.responsavel.nome}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {["APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO"].includes(empresa.situacao) ? "Sem próximo passo marcado. Toda empresa em andamento precisa de um." : "Nenhum marcado."}
              </p>
            )}
          </section>

          {empresa.situacao === "CLIENTE" && (
            <OportunidadesFicha
              clienteId={empresa.id}
              nome={empresa.nomeFantasia}
              fabricaIdsQueCompra={empresa.fabricas.map((cf) => cf.fabricaId)}
              fabricas={fabricasAtivas}
              responsaveis={responsaveis}
              usuarioId={usuario.id}
              oportunidades={empresa.oportunidades.map((o) => {
                const p = empresa.proximosPassos.find((x) => x.oportunidadeId === o.id);
                const prazoOp = p?.prazo.toISOString().slice(0, 10);
                return {
                  id: o.id,
                  fabrica: o.fabrica.nome,
                  tipo: o.tipo,
                  etapa: o.etapa,
                  motivoPerda: o.motivoPerda,
                  passoId: p?.id ?? null,
                  passo: p && prazoOp ? { acao: p.acao, quando: `${descreverPrazo(prazoOp, hoje)} · ${formatarDia(prazoOp)}`, atrasado: situacaoDoPrazo(prazoOp, hoje) === "atrasado", responsavel: p.responsavel.nome } : null,
                };
              })}
            />
          )}

          {empresa.conversas.map((c) => (
            <Bloco key={c.id} id={`conversa-${c.id}`} titulo={`Conversa com ${c.contato?.nome ?? c.nomeNoWhatsapp ?? "Contato"} · ${formatarNumero(c.numero)}`}>
              <ConversaWhatsapp
                destinatario={{ nome: c.contato?.nome ?? c.nomeNoWhatsapp ?? empresa.nomeFantasia, numero: formatarNumero(c.numero) }}
                mensagens={c.mensagens}
                aviso={c._count.mensagens > c.mensagens.length ? `Mostrando as ${c.mensagens.length} mensagens mais recentes de ${c._count.mensagens}.` : undefined}
              />
            </Bloco>
          ))}

          <Bloco titulo="Linha do tempo">
            {eventos.length > 0 ? <Timeline eventos={eventos} /> : <p className="text-sm text-muted-foreground">Ainda não há nada registrado.</p>}
          </Bloco>
        </div>

        <RecolhivelNoCelular titulo="cadastro completo (dados, contatos e pedidos)">
          <Bloco titulo="Dados">
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-y-2 text-sm">
              <dt className="text-muted-foreground">CNPJ</dt>
              <dd className="break-words">{empresa.cnpj ?? "—"}</dd>
              <dt className="text-muted-foreground">Origem</dt>
              <dd className="break-words">{empresa.origem ?? "—"}</dd>
              <dt className="text-muted-foreground">Grupo</dt>
              <dd className="break-words">{empresa.grupo ?? "—"}</dd>
              <dt className="text-muted-foreground">Fábricas</dt>
              <dd className="flex flex-wrap gap-1 break-words">{empresa.fabricas.length ? empresa.fabricas.map((cf) => <Selo key={cf.fabricaId}>{cf.fabrica.nome}</Selo>) : "—"}</dd>
            </dl>
            {empresa.observacoes && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{empresa.observacoes}</p>}
          </Bloco>

          <Bloco
            titulo={`Contatos (${empresa.contatos.length})`}
            acao={podeEditarContatos ? <BotaoNovoContato clienteId={empresa.id} empresa={empresa.nomeFantasia} /> : undefined}
          >
            {empresa.contatos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato com fonte anotada.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {empresa.contatos.map((c) => (
                  <li key={c.id} className="text-sm leading-snug">
                    <p className="font-medium">
                      {c.nome ?? "Canal da empresa"}
                      {c.funcao && <span className="font-normal text-muted-foreground"> · {c.funcao}</span>}
                      {c.naoContatar && <span className="ml-2"><Selo cor="error">Não contatar</Selo></span>}
                    </p>
                    <p className="break-all">{c.valor} <span className="text-muted-foreground">({CANAL[c.canal] ?? c.canal})</span></p>
                    <p className="break-words text-xs text-muted-foreground">Fonte: {c.fonte}</p>
                    {(c.canal === "WHATSAPP" || c.canal === "TELEFONE" || c.naoContatar) && (
                      <ContatoAcoes
                        contatoId={c.id}
                        nome={c.nome ?? empresa.nomeFantasia}
                        origem={c.origemContato}
                        naoContatar={c.naoContatar}
                        podeEscrever={normalizarTelefone(c.valor) !== null && (c.canal === "WHATSAPP" || c.canal === "TELEFONE")}
                      />
                    )}
                    {podeEditarContatos && (
                      <div className="mt-1.5">
                        <BotaoEditarContato
                          clienteId={empresa.id}
                          empresa={empresa.nomeFantasia}
                          numeroTravado={contatosComConversa.includes(c.id)}
                          contato={{ id: c.id, nome: c.nome, funcao: c.funcao, canal: c.canal, valor: c.valor, fonte: c.fonte, observacoes: c.observacoes }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          <Bloco titulo="Pedidos">
            {empresa.pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido no sistema.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {empresa.pedidos.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/pedidos/${p.id}`} className="min-w-0 truncate hover:underline">
                      {p.semNumero ? "S/N" : p.numero} <span className="text-muted-foreground">· {p.fabrica.nome}</span>
                    </Link>
                    <StatusBadge tipo="pedido" valor={p.estado} />
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          {historico.length > 0 && (
            <Bloco titulo="Pedidos recebidos (planilha)">
              <ul className="flex flex-col gap-2 text-sm">
                {historico.map((h) => (
                  <li key={h.fabrica} className="flex items-baseline justify-between gap-2">
                    <span>{h.fabrica} <span className="text-muted-foreground">· {h.pedidos} pedidos</span></span>
                    <span className="tabular font-medium">{brl(h.valor)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Pedidos que chegaram, não faturamento. Linhas suspeitas de duplicidade ficam fora da soma.</p>
            </Bloco>
          )}
        </RecolhivelNoCelular>
      </div>
    </PageContainer>
  );
}
