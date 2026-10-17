import { Prisma, type LinhaWhatsapp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerEventoEvolution, type EventoLido } from "@/domain/mensagens/evolution";
import { casarContato } from "@/domain/mensagens/telefone";
import { classificarPorRegra } from "@/domain/mensagens/supressao";
import { registrarEstadoDaConexao } from "@/lib/integracoes/config";
import { aplicarEfeitosDaEntrada } from "./efeitos";

// Entrada do webhook (ADR-015 §6 e ADR-019). Nada aqui envia mensagem: grava o que chegou e aplica
// no CRM o que uma resposta provoca (efeitos.ts). O celular conectado pode ser o pessoal do Rômulo,
// então só entra o que é de número da base (contato cadastrado ou conversa que já existe); o resto
// não deixa rastro, nem o evento bruto.

type Mensagem = Extract<EventoLido, { tipo: "mensagem" }>;
type Vinculo = Awaited<ReturnType<typeof vinculoDoNumero>>;

const jaExiste = (erro: unknown) => erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";

// Casa o número com o cadastro de contatos (WhatsApp ou telefone). Lê a lista inteira:
// o cadastro é pequeno e o valor do contato é texto livre, então a comparação é em memória.
async function vinculoDoNumero(numero: string) {
  const contatos = await prisma.contato.findMany({
    where: { canal: { in: ["WHATSAPP", "TELEFONE"] } },
    select: { id: true, clienteId: true, valor: true },
  });
  const r = casarContato(numero, contatos);
  if (r.tipo === "unico") return { clienteId: r.clienteId, contatoId: r.contatoId, motivoSemVinculo: null };
  return {
    clienteId: null,
    contatoId: null,
    motivoSemVinculo: r.tipo === "varias_empresas" ? "numero_em_varias_empresas" : "numero_desconhecido",
  };
}

async function obterConversa(linha: LinhaWhatsapp, m: Mensagem, ocorridoEm: Date, vinculoNovo: Vinculo | null) {
  const chave = { linha_numero: { linha, numero: m.numero } };
  let conversa = await prisma.conversa.findUnique({ where: chave });

  if (!conversa) {
    try {
      conversa = await prisma.conversa.create({
        data: { linha, numero: m.numero, nomeNoWhatsapp: m.nomeNoWhatsapp, ultimaMensagemEm: ocorridoEm, ...(vinculoNovo ?? (await vinculoDoNumero(m.numero))) },
      });
    } catch (erro) {
      // Dois eventos do mesmo número chegaram juntos; o outro criou a conversa primeiro.
      if (!jaExiste(erro)) throw erro;
      conversa = await prisma.conversa.findUniqueOrThrow({ where: chave });
    }
  }

  // Número que ainda não tinha dono pode ter ganhado um contato desde a última mensagem.
  const vinculo = conversa.clienteId === null ? await vinculoDoNumero(m.numero) : null;
  const atualizacao: Prisma.ConversaUpdateInput = {};
  if (vinculo && vinculo.clienteId) {
    atualizacao.cliente = { connect: { id: vinculo.clienteId } };
    atualizacao.contato = { connect: { id: vinculo.contatoId! } };
    atualizacao.motivoSemVinculo = null;
  } else if (vinculo && vinculo.motivoSemVinculo !== conversa.motivoSemVinculo) {
    atualizacao.motivoSemVinculo = vinculo.motivoSemVinculo;
  }
  if (m.nomeNoWhatsapp && m.nomeNoWhatsapp !== conversa.nomeNoWhatsapp) atualizacao.nomeNoWhatsapp = m.nomeNoWhatsapp;
  if (ocorridoEm > conversa.ultimaMensagemEm) atualizacao.ultimaMensagemEm = ocorridoEm;
  if (Object.keys(atualizacao).length === 0) return conversa;
  return prisma.conversa.update({ where: { id: conversa.id }, data: atualizacao });
}

// A plataforma envia, e o WhatsApp devolve o eco da mesma mensagem como "minha". Se o eco
// chega antes de a API responder com o id, a mensagem ainda está ENVIANDO sem id: ela é
// adotada em vez de virar uma segunda mensagem "pelo celular". Enviada pelo Chatwoot, ela já
// está ENVIADA sem id (o id do WhatsApp só existe depois que a Evolution envia) e é adotada igual.
async function adotarEcoDeEnvio(conversaId: string, m: Mensagem, ocorridoEm: Date, eventoId: string): Promise<boolean> {
  const candidata = await prisma.mensagem.findFirst({
    where: {
      conversaId,
      direcao: "SAIDA",
      status: { in: ["ENVIANDO", "ENVIADA"] },
      envioManual: false,
      idExterno: null,
      texto: m.texto,
      criadoEm: { gte: new Date(Date.now() - 10 * 60_000) },
    },
    orderBy: { criadoEm: "desc" },
  });
  if (!candidata) return false;
  const { count } = await prisma.mensagem.updateMany({
    where: { id: candidata.id, status: { in: ["ENVIANDO", "ENVIADA"] }, idExterno: null },
    data: { idExterno: m.idExterno, status: "ENVIADA", enviadaEm: ocorridoEm, eventoId },
  });
  return count > 0;
}

async function gravarMensagem(linha: LinhaWhatsapp, eventoId: string, m: Mensagem, chegouEm: Date, vinculo: Vinculo | null): Promise<string> {
  const ocorridoEm = m.ocorridoEm ?? chegouEm;
  const conversa = await obterConversa(linha, m, ocorridoEm, vinculo);

  if (m.direcao === "SAIDA" && (await adotarEcoDeEnvio(conversa.id, m, ocorridoEm, eventoId))) return "adotada";

  const classificacao = m.direcao === "ENTRADA" ? classificarPorRegra(m.texto) : null;
  try {
    // A mensagem e o que ela provoca no CRM andam juntos: se os efeitos falham, a mensagem
    // não fica gravada sem eles e o reenvio do transporte refaz tudo.
    await prisma.$transaction(async (tx) => {
      const criada = await tx.mensagem.create({
        data: {
          conversaId: conversa.id,
          linha,
          idExterno: m.idExterno,
          direcao: m.direcao,
          origem: m.origem,
          tipo: m.tipoMensagem,
          texto: m.texto,
          ocorridoEm,
          eventoId,
          status: m.direcao === "SAIDA" ? "ENVIADA" : "RECEBIDA",
          classificacao,
          classificacaoOrigem: classificacao ? "REGRA" : null,
        },
      });
      if (m.direcao === "ENTRADA") await aplicarEfeitosDaEntrada(tx, { conversa, mensagem: criada, classificacao });
    });
  } catch (erro) {
    if (jaExiste(erro)) return "duplicada";
    throw erro;
  }
  return "mensagem";
}

// Recibo de uma mensagem nossa. Só avança: LIDA nunca volta a ENTREGUE.
async function aplicarRecibo(linha: LinhaWhatsapp, idExterno: string, status: "ENTREGUE" | "LIDA"): Promise<string> {
  const { count } = await prisma.mensagem.updateMany({
    where: {
      linha,
      idExterno,
      direcao: "SAIDA",
      status: { in: status === "ENTREGUE" ? ["ENVIANDO", "ENVIADA"] : ["ENVIANDO", "ENVIADA", "ENTREGUE"] },
    },
    data: { status },
  });
  return count > 0 ? `status: ${status}` : "status: sem mudança";
}

type Avaliacao = { lido: EventoLido; guardar: true; vinculo: Vinculo | null } | { lido: EventoLido; guardar: false; motivo: string };

const FORA_DA_BASE = "ignorado: número fora da base";

// Decide, item a item, o que o sistema pode guardar. Grupo, status, lista de transmissão, contato
// sem telefone (lid) e número de fora da base: nada. Recibo: só de mensagem nossa. Conexão: sempre.
async function avaliar(linha: LinhaWhatsapp, lido: EventoLido): Promise<Avaliacao> {
  switch (lido.tipo) {
    case "ignorado":
    case "sem_numero":
      return { lido, guardar: false, motivo: `ignorado: ${lido.motivo}` };
    case "conexao":
      return { lido, guardar: true, vinculo: null };
    case "status": {
      const nossa = await prisma.mensagem.count({ where: { linha, idExterno: lido.idExterno, direcao: "SAIDA" } });
      return nossa > 0 ? { lido, guardar: true, vinculo: null } : { lido, guardar: false, motivo: "ignorado: recibo de mensagem que não é da base" };
    }
    case "mensagem": {
      const existe = await prisma.conversa.count({ where: { linha, numero: lido.numero } });
      if (existe > 0) return { lido, guardar: true, vinculo: null };
      const vinculo = await vinculoDoNumero(lido.numero);
      // Número em mais de uma empresa é da base: entra sem empresa, para uma pessoa decidir.
      return vinculo.motivoSemVinculo === "numero_desconhecido" ? { lido, guardar: false, motivo: FORA_DA_BASE } : { lido, guardar: true, vinculo };
    }
  }
}

// Evento com vários itens (data em lista): guarda só os itens da base.
function soOQueFica(payload: unknown, avaliacoes: Avaliacao[]): Prisma.InputJsonValue {
  const p = payload as { data?: unknown };
  if (!Array.isArray(p?.data) || p.data.length !== avaliacoes.length) return payload as Prisma.InputJsonValue;
  return { ...(payload as object), data: p.data.filter((_, i) => avaliacoes[i].guardar) } as Prisma.InputJsonValue;
}

// Guarda o evento bruto ANTES de processar (e só se algo nele é da base). Se o processamento
// falhar, o evento continua gravado com o erro e a exceção sobe: o transporte tenta de novo, e a
// gravação é idempotente por (linha, id externo). Ler o evento (lerEventoEvolution) não toca em
// banco nem rede: só serve para decidir o que pode ser guardado.
export async function registrarEvento(linha: LinhaWhatsapp, payload: unknown): Promise<{ eventoId: string | null; resultados: string[] }> {
  const avaliacoes: Avaliacao[] = [];
  for (const lido of lerEventoEvolution(payload)) avaliacoes.push(await avaliar(linha, lido));
  if (!avaliacoes.some((a) => a.guardar)) return { eventoId: null, resultados: avaliacoes.map((a) => (a.guardar ? "" : a.motivo)) };

  const evento = await prisma.eventoWhatsapp.create({ data: { linha, payload: soOQueFica(payload, avaliacoes) } });
  const chegouEm = evento.recebidoEm;

  try {
    const resultados: string[] = [];
    for (const a of avaliacoes) {
      if (!a.guardar) resultados.push(a.motivo);
      else if (a.lido.tipo === "status") resultados.push(await aplicarRecibo(linha, a.lido.idExterno, a.lido.status));
      else if (a.lido.tipo === "conexao") {
        await registrarEstadoDaConexao(a.lido.estado, chegouEm);
        resultados.push(`conexao: ${a.lido.estado}`);
      } else if (a.lido.tipo === "mensagem") resultados.push(await gravarMensagem(linha, evento.id, a.lido, chegouEm, a.vinculo));
    }
    await prisma.eventoWhatsapp.update({
      where: { id: evento.id },
      data: { processadoEm: new Date(), resultado: resultados.join("; ") },
    });
    return { eventoId: evento.id, resultados };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    await prisma.eventoWhatsapp.update({ where: { id: evento.id }, data: { resultado: `erro: ${motivo}`.slice(0, 500) } });
    throw erro;
  }
}
