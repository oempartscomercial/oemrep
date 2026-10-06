import { Prisma, type LinhaWhatsapp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerEventoEvolution, type EventoLido } from "@/domain/mensagens/evolution";
import { casarContato } from "@/domain/mensagens/telefone";
import { classificarPorRegra } from "@/domain/mensagens/supressao";
import { aplicarEfeitosDaEntrada } from "./efeitos";

// Fase 1 do ADR-015: só registro. Nada aqui envia mensagem, muda situação de empresa ou
// cria tarefa; isso é da fase 2.

type Mensagem = Extract<EventoLido, { tipo: "mensagem" }>;

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

async function obterConversa(linha: LinhaWhatsapp, m: Mensagem, ocorridoEm: Date) {
  const chave = { linha_numero: { linha, numero: m.numero } };
  let conversa = await prisma.conversa.findUnique({ where: chave });

  if (!conversa) {
    try {
      conversa = await prisma.conversa.create({
        data: { linha, numero: m.numero, nomeNoWhatsapp: m.nomeNoWhatsapp, ultimaMensagemEm: ocorridoEm, ...(await vinculoDoNumero(m.numero)) },
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
// adotada em vez de virar uma segunda mensagem "pelo celular".
async function adotarEcoDeEnvio(conversaId: string, m: Mensagem, ocorridoEm: Date, eventoId: string): Promise<boolean> {
  const candidata = await prisma.mensagem.findFirst({
    where: {
      conversaId,
      direcao: "SAIDA",
      status: "ENVIANDO",
      idExterno: null,
      texto: m.texto,
      criadoEm: { gte: new Date(Date.now() - 10 * 60_000) },
    },
    orderBy: { criadoEm: "desc" },
  });
  if (!candidata) return false;
  const { count } = await prisma.mensagem.updateMany({
    where: { id: candidata.id, status: "ENVIANDO", idExterno: null },
    data: { idExterno: m.idExterno, status: "ENVIADA", enviadaEm: ocorridoEm, eventoId },
  });
  return count > 0;
}

async function gravarMensagem(linha: LinhaWhatsapp, eventoId: string, m: Mensagem, chegouEm: Date): Promise<string> {
  const ocorridoEm = m.ocorridoEm ?? chegouEm;
  const conversa = await obterConversa(linha, m, ocorridoEm);

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

// Guarda o evento bruto ANTES de ler qualquer coisa, depois processa. Se o processamento
// falhar, o evento continua gravado com o erro e a exceção sobe: o transporte tenta de
// novo, e a gravação é idempotente por (linha, id externo).
export async function registrarEvento(linha: LinhaWhatsapp, payload: unknown) {
  const evento = await prisma.eventoWhatsapp.create({
    data: { linha, payload: payload as Prisma.InputJsonValue },
  });
  const chegouEm = evento.recebidoEm;

  try {
    const resultados: string[] = [];
    for (const lido of lerEventoEvolution(payload)) {
      if (lido.tipo === "ignorado") resultados.push(`ignorado: ${lido.motivo}`);
      else if (lido.tipo === "sem_numero") resultados.push(`sem_numero: ${lido.motivo}`);
      else if (lido.tipo === "status") resultados.push(await aplicarRecibo(linha, lido.idExterno, lido.status));
      else resultados.push(await gravarMensagem(linha, evento.id, lido, chegouEm));
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
