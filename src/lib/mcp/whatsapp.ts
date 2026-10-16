import type { UsuarioSessao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/domain/mensagens/telefone";
import { descreverMomento, interpretarMomento } from "@/domain/mensagens/agendamento";
import { diaEmSaoPaulo, formatarHora, formatarNumero } from "@/domain/mensagens/exibicao";
import { lerEvolution } from "@/lib/integracoes/config";
import { clienteEvolution } from "@/lib/integracoes/evolution-api";
import { obterTransporte, type EstadoDaLinha } from "@/lib/whatsapp/transporte";
import { lerLimites, JA_SAIU } from "@/lib/whatsapp/limites";
import { verificarMensagem } from "@/lib/whatsapp/verificacao";
import { aprovarMensagem, cancelarMensagem, JA_EXISTE_PENDENTE, prepararRascunho } from "@/lib/whatsapp/mensagens";
import type { TipoEnvio } from "@/domain/mensagens/rascunho";
import { nomeComLocal, resolverEmpresa } from "./resolver";
import type { Resposta } from "./consultas";

// WhatsApp de prospecção pelo MCP (ADR-019). O Claude prepara o rascunho, mostra ao usuário e só
// aprova depois do OK dele; a aprovação sai no nome do dono do token, marcada "pelo Claude". As
// regras são as mesmas das telas (src/lib/whatsapp/mensagens.ts e despachar): nada aqui decide se
// pode enviar. Segredo das integrações nunca aparece nas respostas.

const falha = (texto: string): Resposta => ({ texto, erro: true });
const autor = (u: UsuarioSessao) => ({ id: u.id, nome: u.nome });
const chave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const citar = (t: string | null, max = 300) => `«${(t ?? "").length > max ? `${(t ?? "").slice(0, max)}…` : (t ?? "")}»`;
const ROTULO_TIPO: Record<TipoEnvio, string> = { PRIMEIRO_CONTATO: "primeiro contato", FOLLOW_UP: "follow-up", RESPOSTA: "resposta" };
const TIPOS: Record<string, TipoEnvio> = { primeiro_contato: "PRIMEIRO_CONTATO", follow_up: "FOLLOW_UP", resposta: "RESPOSTA" };
const quando = (d: Date) => descreverMomento(d);
const SEM_AUTOMATICO =
  "O envio automático está desligado: depois de aprovada, a mensagem sai pelo celular de prospecção (na ficha da empresa, 'Abrir no WhatsApp' e depois 'Já enviei').";

type ContatoDeTelefone = { id: string; nome: string | null; funcao: string | null; valor: string; numero: string; naoContatar: boolean };

async function contatosDeTelefone(clienteId: string): Promise<ContatoDeTelefone[]> {
  const contatos = await prisma.contato.findMany({
    where: { clienteId, canal: { in: ["WHATSAPP", "TELEFONE"] } },
    orderBy: [{ canal: "asc" }, { criadoEm: "asc" }],
    select: { id: true, nome: true, funcao: true, valor: true, naoContatar: true },
  });
  return contatos.flatMap((c) => {
    const numero = normalizarTelefone(c.valor);
    return numero ? [{ ...c, numero }] : [];
  });
}

const descreverContato = (c: ContatoDeTelefone) => [c.nome, c.funcao].filter(Boolean).join(", ") || "sem nome";

/** Contato da empresa pelo nome ou pelo número. Número que não está cadastrado não vale: o contato precisa de fonte. */
function escolherContato(contatos: ContatoDeTelefone[], args: { contato?: string; numero?: string }, empresa: string): { ok: true; contato: ContatoDeTelefone } | { ok: false; mensagem: string } {
  const lista = () => contatos.map((c) => `- ${descreverContato(c)} · ${formatarNumero(c.numero)}`).join("\n");
  if (contatos.length === 0) {
    return { ok: false, mensagem: `${empresa} não tem contato de WhatsApp ou telefone cadastrado. Cadastre com adicionar_contato (com a fonte e a origem do número) antes de escrever.` };
  }
  const pedidoNumero = args.numero?.trim() || (args.contato && /\d{8,}/.test(args.contato.replace(/\D/g, "")) ? args.contato : "");
  if (pedidoNumero) {
    const numero = normalizarTelefone(pedidoNumero);
    const achado = numero ? contatos.find((c) => c.numero === numero) : undefined;
    if (!achado) {
      return { ok: false, mensagem: `O número ${pedidoNumero} não está cadastrado em ${empresa}. Só se escreve para contato cadastrado com fonte: use adicionar_contato antes (nunca deduza número). Contatos de telefone desta empresa:\n${lista()}` };
    }
    return { ok: true, contato: achado };
  }
  if (args.contato?.trim()) {
    const termo = chave(args.contato);
    const achados = contatos.filter((c) => c.nome && chave(c.nome).includes(termo));
    if (achados.length === 1) return { ok: true, contato: achados[0] };
    return { ok: false, mensagem: achados.length === 0 ? `Nenhum contato "${args.contato}" com telefone em ${empresa}. Contatos:\n${lista()}` : `Mais de um contato "${args.contato}" em ${empresa}. Diga o número:\n${lista()}` };
  }
  if (contatos.length === 1) return { ok: true, contato: contatos[0] };
  return { ok: false, mensagem: `${empresa} tem mais de um contato de telefone. Pergunte ao usuário para qual e repita com contato ou numero:\n${lista()}` };
}

// ---------------------------------------------------------------------------- preparar

export type PrepararArgs = { empresa: string; contato?: string; numero?: string; texto: string; tipo?: string };

export async function prepararMensagemWhatsapp(usuario: UsuarioSessao, args: PrepararArgs): Promise<Resposta> {
  const r = await resolverEmpresa(args.empresa);
  if (!r.ok) return falha(r.mensagem);
  const empresa = r.valor;
  const nomeEmpresa = nomeComLocal(empresa);

  const escolha = escolherContato(await contatosDeTelefone(empresa.id), args, nomeEmpresa);
  if (!escolha.ok) return falha(escolha.mensagem);
  const contato = escolha.contato;
  if (contato.naoContatar) return falha(`${descreverContato(contato)} (${nomeEmpresa}) pediu para não ser contatado. Nada foi preparado; só uma pessoa desfaz isso, na ficha.`);

  const tipo = args.tipo ? TIPOS[args.tipo] : undefined;
  const rascunho = await prepararRascunho(autor(usuario), { contatoId: contato.id, texto: args.texto, tipo, geradaPorIa: true });
  if (rascunho.erros.length > 0 || !rascunho.id) {
    if (rascunho.erros.includes(JA_EXISTE_PENDENTE)) {
      const pendente = await prisma.mensagem.findFirst({
        where: { direcao: "SAIDA", status: { in: ["RASCUNHO", "APROVADA"] }, conversa: { linha: "PROSPECCAO", numero: contato.numero } },
        orderBy: { criadoEm: "desc" },
      });
      if (pendente) {
        return falha(
          `Já existe uma mensagem ${pendente.status === "RASCUNHO" ? "em rascunho" : "aprovada esperando para sair"} para ${descreverContato(contato)}: ${citar(pendente.texto)} [mensagem_id: ${pendente.id}]. Nada novo foi criado. Pergunte ao usuário se quer usar essa (aprovar) ou cancelar (cancelar_mensagem_whatsapp) e escrever outra.`,
        );
      }
    }
    return falha(`Nada foi criado. ${rascunho.erros.join(" ")}${rascunho.avisos?.length ? ` Avisos: ${rascunho.avisos.join(" ")}` : ""}`);
  }

  const mensagem = await prisma.mensagem.findUniqueOrThrow({ where: { id: rascunho.id }, include: { conversa: { include: { cliente: true, contato: true } } } });
  const transporte = await obterTransporte();
  const automatico = transporte.nome !== "desligado";
  // Sem envio automático, a linha "desligada" não seguraria nada: quem envia é a pessoa, pelo celular.
  const linha: EstadoDaLinha = automatico ? await transporte.estado().catch((): EstadoDaLinha => "desconhecida") : "conectada";
  const avaliacao = await verificarMensagem(mensagem, { agora: new Date(), linha });
  const bloqueios = avaliacao && !avaliacao.verificacao.ok ? avaliacao.verificacao.bloqueios : [];

  const linhas = [
    "Rascunho criado. AINDA NÃO FOI APROVADO NEM ENVIADO.",
    `Para: ${descreverContato(contato)} · ${nomeEmpresa} · WhatsApp ${formatarNumero(contato.numero)}`,
    `Tipo: ${ROTULO_TIPO[rascunho.tipo!]}`,
    `Texto exato:\n${mensagem.texto}`,
    ...(rascunho.avisos?.length ? [`Avisos sobre o texto: ${rascunho.avisos.join(" ")}`] : []),
    bloqueios.length === 0
      ? "Nada impede o envio agora."
      : `O que seguraria o envio agora:\n${bloqueios.map((b) => `- ${b.texto} (${b.espera ? "espera: sai sozinha quando resolver" : "impede: se aprovada assim, a mensagem é cancelada"})`).join("\n")}`,
    ...(automatico ? [] : [SEM_AUTOMATICO]),
    "Próximo passo: mostre ao usuário o destinatário e o texto exato acima e pergunte se pode enviar (agora ou em que dia e hora). Só chame aprovar_mensagem_whatsapp depois do OK explícito dele para ESTE texto. Se ele quiser mudar algo, cancele este rascunho e prepare outro.",
    `[mensagem_id: ${rascunho.id}]`,
  ];
  return { texto: linhas.join("\n") };
}

// ---------------------------------------------------------------------------- aprovar / cancelar

async function mensagemComDestino(id: string) {
  return prisma.mensagem.findUnique({
    where: { id },
    include: { conversa: { include: { cliente: { select: { nomeFantasia: true, cidade: true, uf: true } }, contato: { select: { nome: true } } } } },
  });
}
type ComDestino = NonNullable<Awaited<ReturnType<typeof mensagemComDestino>>>;
const destino = (m: ComDestino) =>
  `${m.conversa.contato?.nome ?? "o contato"}${m.conversa.cliente ? ` (${nomeComLocal(m.conversa.cliente)})` : ""}, WhatsApp ${formatarNumero(m.conversa.numero)}`;

export async function aprovarMensagemWhatsapp(usuario: UsuarioSessao, args: { mensagem_id: string; enviar_em?: string }): Promise<Resposta> {
  const m = await mensagemComDestino(args.mensagem_id);
  if (!m || m.direcao !== "SAIDA") return falha("Mensagem não encontrada. Use mensagens_whatsapp com filtro rascunhos para ver o id certo.");
  if (m.status !== "RASCUNHO") return falha(`Esta mensagem não é um rascunho (situação: ${m.status.toLowerCase()}). Nada foi feito.`);

  const agora = new Date();
  let agendadaPara: Date | null = null;
  if (args.enviar_em?.trim()) {
    const momento = interpretarMomento(args.enviar_em, agora, (await lerLimites()).horarioInicio);
    if (!momento) return falha(`Não entendi quando enviar ("${args.enviar_em}"). Use "agora", "amanhã 9h", "segunda 14h" ou DD/MM/AAAA HH:MM. Nada foi aprovado.`);
    agendadaPara = momento.tipo === "em" ? momento.quando : null;
    if (agendadaPara && agendadaPara.getTime() <= agora.getTime()) return falha(`Esse horário (${quando(agendadaPara)}) já passou. Pergunte outro ao usuário. Nada foi aprovado.`);
  }

  const r = await aprovarMensagem(autor(usuario), { id: m.id, agendadaPara, peloClaude: true }, { agora });
  if (r.erros.length > 0) return falha(`Nada foi aprovado. ${r.erros.join(" ")}`);

  const para = destino(m);
  const aprovacao = `Aprovada por ${usuario.nome}, pelo Claude.`;
  switch (r.status) {
    case "ENVIADA":
      return { texto: `ENVIADA agora para ${para}. ${aprovacao}` };
    case "AGENDADA":
      return { texto: `AGENDADA para ${para}. ${r.motivo} ${aprovacao} Para cancelar antes, use cancelar_mensagem_whatsapp. [mensagem_id: ${m.id}]` };
    case "APROVADA": {
      const automatico = (await obterTransporte()).nome !== "desligado";
      if (!automatico) return { texto: `APROVADA para ${para}. ${aprovacao} ${SEM_AUTOMATICO} [mensagem_id: ${m.id}]` };
      return { texto: `APROVADA, mas ainda não saiu: ${r.motivo} Ela sai sozinha quando a espera acabar (o sistema tenta de novo a cada poucos minutos). ${aprovacao} [mensagem_id: ${m.id}]` };
    }
    case "CANCELADA":
      return falha(`BLOQUEADA e cancelada (não foi enviada): ${r.motivo}`);
    case "FALHOU":
      return falha(`FALHOU ao enviar para ${para}: ${r.motivo}`);
    default:
      return falha("Nada foi feito: a mensagem já não estava pendente.");
  }
}

export async function cancelarMensagemWhatsapp(usuario: UsuarioSessao, args: { mensagem_id: string }): Promise<Resposta> {
  const m = await mensagemComDestino(args.mensagem_id);
  if (!m || m.direcao !== "SAIDA") return falha("Mensagem não encontrada.");
  const r = await cancelarMensagem(autor(usuario), m.id);
  if (r.erros.length > 0) return falha(r.erros.join(" "));
  return { texto: `Cancelada a mensagem para ${destino(m)}: ${citar(m.texto)}. Ela não será enviada.` };
}

// ---------------------------------------------------------------------------- consultas

const FILTROS = ["rascunhos", "agendadas", "enviadas_hoje", "respostas"] as const;
export type FiltroMensagens = (typeof FILTROS)[number];

function bloco(titulo: string, linhas: string[], vazio: string, limite = 20): string {
  if (linhas.length === 0) return `${titulo} (0)\n- ${vazio}`;
  return [`${titulo} (${linhas.length})`, ...linhas.slice(0, limite), ...(linhas.length > limite ? [`- … e mais ${linhas.length - limite}`] : [])].join("\n");
}

const incluirDestino = { conversa: { include: { cliente: { select: { nomeFantasia: true, cidade: true, uf: true } }, contato: { select: { nome: true } } } } } as const;

async function rascunhos() {
  const lista = await prisma.mensagem.findMany({ where: { linha: "PROSPECCAO", direcao: "SAIDA", status: "RASCUNHO" }, orderBy: { criadoEm: "asc" }, include: incluirDestino });
  return bloco("RASCUNHOS ESPERANDO APROVAÇÃO", lista.map((m) => `- ${destino(m)} · ${ROTULO_TIPO[m.tipoEnvio ?? "RESPOSTA"]}: ${citar(m.texto)} [mensagem_id: ${m.id}]`), "nenhum");
}

async function agendadas() {
  const lista = await prisma.mensagem.findMany({
    where: { linha: "PROSPECCAO", direcao: "SAIDA", status: "APROVADA" },
    orderBy: [{ agendadaPara: { sort: "asc", nulls: "first" } }, { aprovadaEm: "asc" }],
    include: incluirDestino,
  });
  const agora = new Date();
  return bloco(
    "APROVADAS QUE AINDA NÃO SAÍRAM",
    lista.map((m) => {
      const situacao = m.agendadaPara && m.agendadaPara > agora ? `agendada para ${quando(m.agendadaPara)}` : `esperando${m.motivoBloqueio ? `: ${m.motivoBloqueio}` : ""}`;
      return `- ${destino(m)} · ${situacao}: ${citar(m.texto, 200)} [mensagem_id: ${m.id}]`;
    }),
    "nenhuma",
  );
}

const ROTULO_SAIU: Record<string, string> = { ENVIANDO: "enviando", ENVIADA: "enviada", ENTREGUE: "entregue", LIDA: "lida" };

async function enviadasHoje() {
  const inicio = new Date(`${diaEmSaoPaulo(new Date())}T00:00:00-03:00`);
  const lista = await prisma.mensagem.findMany({
    where: { linha: "PROSPECCAO", direcao: "SAIDA", status: { in: [...JA_SAIU] }, OR: [{ enviadaEm: { gte: inicio } }, { enviadaEm: null, ocorridoEm: { gte: inicio } }] },
    orderBy: { ocorridoEm: "asc" },
    include: incluirDestino,
  });
  return bloco(
    "ENVIADAS HOJE",
    lista.map((m) => {
      const como = m.envioManual || m.origem === "ROMULO_NO_CELULAR" ? " pelo celular" : "";
      return `- ${formatarHora(m.enviadaEm ?? m.ocorridoEm)} ${destino(m)} · ${ROTULO_SAIU[m.status]}${como}: ${citar(m.texto, 200)}`;
    }),
    "nenhuma",
  );
}

const REAIS = ["RECEBIDA", "ENVIANDO", "ENVIADA", "ENTREGUE", "LIDA"] as const;

/** Conversas da base cuja última mensagem é do contato: é o "precisa de você" da ficha. */
async function respostas() {
  const conversas = await prisma.conversa.findMany({
    where: { linha: "PROSPECCAO", clienteId: { not: null } },
    orderBy: { ultimaMensagemEm: "desc" },
    take: 200,
    include: {
      cliente: { select: { nomeFantasia: true, cidade: true, uf: true } },
      contato: { select: { nome: true } },
      mensagens: { where: { status: { in: [...REAIS] } }, orderBy: { ocorridoEm: "desc" }, take: 1 },
    },
  });
  const esperando = conversas.filter((c) => c.mensagens[0]?.direcao === "ENTRADA");
  return bloco(
    "RESPOSTAS ESPERANDO RETORNO",
    esperando.map((c) => {
      const m = c.mensagens[0];
      return `- ${c.contato?.nome ?? c.nomeNoWhatsapp ?? "contato"} (${nomeComLocal(c.cliente!)}) · ${formatarNumero(c.numero)} · ${quando(m.ocorridoEm)}: ${citar(m.texto ?? "(mensagem sem texto: áudio, imagem ou documento)", 200)}`;
    }),
    "ninguém esperando resposta",
  );
}

export async function mensagensWhatsapp(args: { filtro?: string }): Promise<Resposta> {
  const filtro = args.filtro as FiltroMensagens | undefined;
  const partes: Record<FiltroMensagens, () => Promise<string>> = { rascunhos, agendadas, enviadas_hoje: enviadasHoje, respostas };
  const escolhidos = filtro && FILTROS.includes(filtro) ? [filtro] : [...FILTROS];
  const textos = await Promise.all(escolhidos.map((f) => partes[f]()));
  return { texto: `WhatsApp de prospecção — ${quando(new Date())}\n${textos.join("\n\n")}` };
}

const ESTADO: Record<string, string> = { conectada: "CONECTADO", desconectada: "DESCONECTADO", conectando: "CONECTANDO (esperando o QR Code ser lido)", desconhecida: "SEM RESPOSTA (não consegui confirmar)" };

export async function statusWhatsapp(): Promise<Resposta> {
  let cfg: Awaited<ReturnType<typeof lerEvolution>>;
  try {
    cfg = await lerEvolution();
  } catch {
    return falha("A configuração do WhatsApp salva no sistema não pôde ser lida (a chave do servidor mudou?). Peça ao Arthur para conferir a tela Integrações.");
  }
  const [pendentes, linhaInteg] = await Promise.all([
    prisma.mensagem.groupBy({ by: ["status"], where: { linha: "PROSPECCAO", direcao: "SAIDA", status: { in: ["RASCUNHO", "APROVADA"] } }, _count: true }),
    prisma.integracao.findUnique({ where: { tipo: "EVOLUTION" }, select: { webhookConfiguradoEm: true } }),
  ]);
  const conta = (s: string) => pendentes.find((p) => p.status === s)?._count ?? 0;
  const fila = `Fila: ${conta("RASCUNHO")} rascunho(s) esperando aprovação e ${conta("APROVADA")} aprovada(s) esperando para sair.`;
  if (!cfg) return { texto: `WhatsApp de prospecção: NÃO CONFIGURADO no sistema (Administração → Integrações). As mensagens aprovadas saem pelo celular, com "Já enviei" na ficha.\n${fila}` };

  const estado = await clienteEvolution(cfg).estado();
  const conexao = !estado.existe
    ? `a instância "${cfg.instancia}" não existe na Evolution (crie na tela Integrações)`
    : `${ESTADO[estado.estado]}${estado.numero ? ` com o número ${formatarNumero(estado.numero)}` : ""}`;
  const linhas = [
    `WhatsApp de prospecção: ${conexao}.`,
    cfg.envioAutomatico ? "Envio automático: LIGADO (aprovada sai sozinha, dentro das regras)." : `Envio automático: DESLIGADO. ${SEM_AUTOMATICO}`,
    cfg.origem === "tela"
      ? linhaInteg?.webhookConfiguradoEm
        ? `Recebimento de respostas: configurado em ${quando(linhaInteg.webhookConfiguradoEm)}.`
        : "Recebimento de respostas: webhook NÃO configurado (as respostas não chegam ao sistema). Configure na tela Integrações."
      : "Configuração pelas variáveis do servidor (sem a tela Integrações).",
    fila,
  ];
  return { texto: linhas.join("\n") };
}
