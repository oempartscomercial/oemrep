import type { Cliente, OrigemInteracao, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compararCampos } from "@/domain/auditoria/evento";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";
import { etapaAtivaOp, oportunidadeAberta } from "@/domain/crm/oportunidade";
import { etapaAtiva, resumoDoMovimento, validarMovimento, type DadosMovimento } from "@/domain/crm/funil";
import { gravarNovoContato, prepararNovoContato, type ContatoPreparado, type EntradaContato } from "./contatos";

// Regras de gravação do CRM sobre a empresa (ADR-013): mover de etapa, registrar o que
// aconteceu, próximo passo e "não contatar". A tela (server actions) e o Claude (servidor MCP)
// chamam as mesmas funções; quem chama já conferiu a sessão e a permissão.

/** Quem grava: o usuário e por onde (tela ou Claude), para a linha do tempo mostrar. */
export type Autor = { id: string; nome: string; origem: Extract<OrigemInteracao, "USUARIO" | "CLAUDE"> };

export type PassoEntrada = { acao: string; prazo: string; responsavelId: string };
export type Resultado = { erros: string[] };

type Tx = Prisma.TransactionClient;

export const comoData = (dia: string) => new Date(`${dia}T00:00:00Z`);

// Responsável precisa ser alguém que usa o CRM e está ativo.
export async function responsavelValido(id: string) {
  const u = await prisma.usuario.findUnique({ where: { id } });
  return !!u && u.ativo && u.perfil !== "OPERADOR";
}

export function validarPasso(passo: PassoEntrada, hoje: string): string[] {
  // Reaproveita a regra do funil: etapa ativa exige ação, data (não passada) e responsável.
  return validarMovimento({ de: "CANDIDATA", para: "APROVADA", naoContatar: false }, { proximoPasso: passo }, hoje);
}

/** Mudança de etapa já validada: situação, passos, linha do tempo e auditoria. */
async function aplicarMovimento(
  tx: Tx,
  autor: Autor,
  empresa: Pick<Cliente, "id" | "situacao" | "naoContatar">,
  para: string,
  dados: DadosMovimento,
  marcarNaoContatar: boolean,
) {
  await tx.cliente.update({
    where: { id: empresa.id },
    data: { situacao: para as Cliente["situacao"], ...(marcarNaoContatar ? { naoContatar: true } : {}) },
  });
  // O passo antigo deixa de valer: o novo (ou nenhum) assume.
  await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, oportunidadeId: null, concluidoEm: null }, data: { concluidoEm: new Date() } });
  if (etapaAtiva(para) && dados.proximoPasso) {
    await tx.proximoPasso.create({
      data: {
        clienteId: empresa.id,
        acao: dados.proximoPasso.acao.trim(),
        prazo: comoData(dados.proximoPasso.prazo),
        responsavelId: dados.proximoPasso.responsavelId,
      },
    });
  }
  if (para === "PAUSADA" && dados.retomadaEm) {
    await tx.proximoPasso.create({
      data: { clienteId: empresa.id, acao: "Retomar contato", prazo: comoData(dados.retomadaEm), responsavelId: autor.id },
    });
  }
  await tx.interacao.create({
    data: {
      clienteId: empresa.id,
      data: new Date(),
      canal: "OUTRO",
      resumo: resumoDoMovimento(empresa.situacao, para, dados),
      origem: autor.origem,
      usuarioId: autor.id,
    },
  });
  const eventos = [
    ...compararCampos("Cliente", empresa.id, autor.id, { situacao: empresa.situacao }, { situacao: para }),
    ...(marcarNaoContatar ? compararCampos("Cliente", empresa.id, autor.id, { naoContatar: false }, { naoContatar: true }) : []),
  ];
  if (eventos.length > 0) await tx.eventoAuditoria.createMany({ data: eventos });
}

export async function moverEmpresa(
  autor: Autor,
  entrada: {
    clienteId: string;
    para: string;
    proximoPasso?: PassoEntrada | null;
    retomadaEm?: string | null;
    motivo?: string | null;
    naoContatar?: boolean;
  },
): Promise<Resultado> {
  const empresa = await prisma.cliente.findUnique({ where: { id: entrada.clienteId } });
  if (!empresa) return { erros: ["Empresa não encontrada."] };

  const dados: DadosMovimento = { proximoPasso: entrada.proximoPasso, retomadaEm: entrada.retomadaEm, motivo: entrada.motivo };
  const erros = validarMovimento({ de: empresa.situacao, para: entrada.para, naoContatar: empresa.naoContatar }, dados, hojeEmSaoPaulo());
  if (erros.length > 0) return { erros };
  if (entrada.proximoPasso && !(await responsavelValido(entrada.proximoPasso.responsavelId))) {
    return { erros: ["O responsável escolhido não pode receber tarefas."] };
  }
  const marcarNaoContatar = entrada.para === "DESCARTADA" && entrada.naoContatar === true && !empresa.naoContatar;

  try {
    await prisma.$transaction((tx) => aplicarMovimento(tx, autor, empresa, entrada.para, dados, marcarNaoContatar));
  } catch {
    return { erros: ["Falha ao mover a empresa. Nada foi salvo — tente novamente."] };
  }
  return { erros: [] };
}

export const CANAIS_INTERACAO = ["WHATSAPP", "TELEFONE", "EMAIL", "VISITA", "REUNIAO", "OUTRO"] as const;

export type EntradaInteracao = {
  clienteId: string;
  canal: string;
  resumo: string;
  comQuem?: string | null;
  resultado?: string | null;
  proximoPasso?: PassoEntrada | null;
  /** Contato sobre uma oportunidade da carteira: o passo exigido e substituído é o dela. */
  oportunidadeId?: string | null;
  /** Quando aconteceu. Padrão: agora. */
  data?: Date;
  /** Muda a etapa da empresa junto (prospecção). Mesmas regras do arraste no funil. */
  situacao?: string | null;
  motivo?: string | null;
  retomadaEm?: string | null;
  /** A pessoa disse que não há próximo passo: o aberto é encerrado e nenhum é criado. */
  semProximoPasso?: boolean;
  /** Pediu para não ser contatada: vale na hora para a empresa e todos os contatos dela. */
  naoContatar?: boolean;
  /** Contato novo que apareceu na conversa. */
  contatoNovo?: Omit<EntradaContato, "clienteId"> | null;
};

export type ResultadoInteracao = Resultado & { avisos?: string[] };

const MENSAGEM_NAO_CONTATAR = "Cancelada: a empresa pediu para não ser contatada.";

/**
 * "Não contatar" da empresa inteira: a empresa e todos os contatos dela ficam marcados, as
 * mensagens que ainda não saíram são canceladas e os passos abertos da empresa se encerram.
 * Prospecção vai para DESCARTADA; cliente continua cliente (só não é mais procurado).
 */
async function aplicarNaoContatar(tx: Tx, autor: Autor, empresa: Cliente) {
  if (empresa.situacao !== "CLIENTE" && empresa.situacao !== "DESCARTADA") {
    await aplicarMovimento(tx, autor, empresa, "DESCARTADA", { motivo: "Pediu para não ser contatada" }, !empresa.naoContatar);
  } else if (!empresa.naoContatar) {
    await tx.cliente.update({ where: { id: empresa.id }, data: { naoContatar: true } });
    await tx.eventoAuditoria.createMany({ data: compararCampos("Cliente", empresa.id, autor.id, { naoContatar: false }, { naoContatar: true }) });
  }
  await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, oportunidadeId: null, concluidoEm: null }, data: { concluidoEm: new Date() } });
  const contatos = await tx.contato.findMany({ where: { clienteId: empresa.id, naoContatar: false }, select: { id: true } });
  if (contatos.length > 0) {
    await tx.contato.updateMany({ where: { id: { in: contatos.map((c) => c.id) } }, data: { naoContatar: true } });
    await tx.eventoAuditoria.createMany({
      data: contatos.flatMap((c) => compararCampos("Contato", c.id, autor.id, { naoContatar: false }, { naoContatar: true })),
    });
  }
  await tx.mensagem.updateMany({
    where: { direcao: "SAIDA", status: { in: ["RASCUNHO", "APROVADA"] }, conversa: { clienteId: empresa.id } },
    data: { status: "CANCELADA", motivoBloqueio: MENSAGEM_NAO_CONTATAR },
  });
}

/**
 * Registra o que aconteceu com a empresa. Regra que não muda: empresa (ou oportunidade) em
 * andamento sai daqui com próximo passo com data e responsável, a menos que a pessoa diga
 * explicitamente que não há (semProximoPasso) — aí a resposta avisa.
 */
export async function registrarInteracao(autor: Autor, entrada: EntradaInteracao): Promise<ResultadoInteracao> {
  if (!(CANAIS_INTERACAO as readonly string[]).includes(entrada.canal)) return { erros: ["Escolha como foi o contato."] };
  if (!entrada.resumo.trim()) return { erros: ["Conte em uma frase o que aconteceu."] };
  if (entrada.data && entrada.data.getTime() > Date.now()) return { erros: ["A data do contato não pode estar no futuro."] };

  const empresa = await prisma.cliente.findUnique({
    where: { id: entrada.clienteId },
    include: { proximosPassos: { where: { concluidoEm: null } } },
  });
  if (!empresa) return { erros: ["Empresa não encontrada."] };

  const oportunidadeId = entrada.oportunidadeId ?? null;
  const oportunidade = oportunidadeId ? await prisma.oportunidade.findUnique({ where: { id: oportunidadeId } }) : null;
  if (oportunidadeId && (!oportunidade || oportunidade.clienteId !== empresa.id || !oportunidadeAberta(oportunidade.etapa))) {
    return { erros: ["Esta oportunidade não está mais aberta."] };
  }
  if (entrada.semProximoPasso && entrada.proximoPasso) return { erros: ["Escolha: ou há próximo passo, ou não há."] };
  if (entrada.naoContatar && (entrada.proximoPasso || entrada.situacao)) {
    return { erros: ["Empresa que pediu para não ser contatada não recebe próximo passo nem muda de etapa."] };
  }
  if (entrada.naoContatar && oportunidadeId) return { erros: ["\"Não contatar\" vale para a empresa toda, não para uma oportunidade."] };
  const hoje = hojeEmSaoPaulo();

  // Mudança de etapa junto: mesmas regras do arraste no funil (o passo vai com ela).
  const para = entrada.situacao && entrada.situacao !== empresa.situacao ? entrada.situacao : null;
  const dadosMovimento: DadosMovimento = { proximoPasso: entrada.proximoPasso, retomadaEm: entrada.retomadaEm, motivo: entrada.motivo };
  if (para) {
    if (oportunidadeId) return { erros: ["A etapa da empresa não muda num registro de oportunidade."] };
    const erros = validarMovimento({ de: empresa.situacao, para, naoContatar: empresa.naoContatar }, dadosMovimento, hoje);
    if (erros.length > 0) return { erros };
  } else if (!entrada.naoContatar && !entrada.semProximoPasso) {
    // Os passos da empresa e os de cada oportunidade são independentes.
    const passosDoEscopo = empresa.proximosPassos.filter((p) => p.oportunidadeId === oportunidadeId);
    const exigePasso = oportunidade ? etapaAtivaOp(oportunidade.etapa) : etapaAtiva(empresa.situacao);
    if (exigePasso && !entrada.proximoPasso && passosDoEscopo.length === 0) return { erros: ["Diga qual é o próximo passo."] };
  }
  if (entrada.proximoPasso) {
    const erros = validarPasso(entrada.proximoPasso, hoje);
    if (erros.length > 0) return { erros };
    if (!(await responsavelValido(entrada.proximoPasso.responsavelId))) return { erros: ["O responsável escolhido não pode receber tarefas."] };
  }

  let contato: ContatoPreparado | null = null;
  if (entrada.contatoNovo) {
    const r = await prepararNovoContato({ ...entrada.contatoNovo, clienteId: empresa.id });
    if (!("preparado" in r)) return { erros: r.erros.map((e) => `Contato novo: ${e}`) };
    contato = r.preparado;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.interacao.create({
        data: {
          clienteId: empresa.id,
          data: entrada.data ?? new Date(),
          canal: entrada.canal as (typeof CANAIS_INTERACAO)[number],
          comQuem: entrada.comQuem?.trim() || null,
          resumo: entrada.resumo.trim(),
          resultado: entrada.resultado?.trim() || null,
          origem: autor.origem,
          usuarioId: autor.id,
          oportunidadeId,
        },
      });
      if (contato) await gravarNovoContato(tx, autor.id, contato);
      if (entrada.naoContatar) {
        await aplicarNaoContatar(tx, autor, empresa);
      } else if (para) {
        await aplicarMovimento(tx, autor, empresa, para, dadosMovimento, false);
      } else if (entrada.proximoPasso) {
        await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, oportunidadeId, concluidoEm: null }, data: { concluidoEm: new Date() } });
        await tx.proximoPasso.create({
          data: {
            clienteId: empresa.id,
            oportunidadeId,
            acao: entrada.proximoPasso.acao.trim(),
            prazo: comoData(entrada.proximoPasso.prazo),
            responsavelId: entrada.proximoPasso.responsavelId,
          },
        });
      } else if (entrada.semProximoPasso) {
        await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, oportunidadeId, concluidoEm: null }, data: { concluidoEm: new Date() } });
      }
    });
  } catch {
    return { erros: ["Falha ao registrar. Nada foi salvo — tente novamente."] };
  }

  const situacaoFinal = entrada.naoContatar ? null : (para ?? empresa.situacao);
  const ativa = oportunidade ? etapaAtivaOp(oportunidade.etapa) : situacaoFinal !== null && etapaAtiva(situacaoFinal);
  const avisos = entrada.semProximoPasso && ativa ? ["Empresa em andamento ficou sem próximo passo."] : [];
  return { erros: [], avisos };
}

/** Dá baixa no próximo passo. Empresa em andamento precisa já deixar o seguinte marcado. */
export async function concluirProximoPasso(_autor: Autor, entrada: { id: string; proximo?: PassoEntrada | null }): Promise<Resultado & { clienteId?: string }> {
  const passo = await prisma.proximoPasso.findUnique({ where: { id: entrada.id }, include: { cliente: true, oportunidade: true } });
  if (!passo || passo.concluidoEm) return { erros: ["Este próximo passo não está mais aberto."] };

  const exigeProximo = passo.oportunidade ? etapaAtivaOp(passo.oportunidade.etapa) : etapaAtiva(passo.cliente.situacao);
  if (exigeProximo && !entrada.proximo) return { erros: ["Diga qual é o próximo passo."] };
  if (entrada.proximo) {
    const erros = validarPasso(entrada.proximo, hojeEmSaoPaulo());
    if (erros.length > 0) return { erros };
    if (!(await responsavelValido(entrada.proximo.responsavelId))) return { erros: ["O responsável escolhido não pode receber tarefas."] };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.proximoPasso.update({ where: { id: passo.id }, data: { concluidoEm: new Date() } });
      if (entrada.proximo) {
        await tx.proximoPasso.create({
          data: {
            clienteId: passo.clienteId,
            oportunidadeId: passo.oportunidadeId,
            acao: entrada.proximo.acao.trim(),
            prazo: comoData(entrada.proximo.prazo),
            responsavelId: entrada.proximo.responsavelId,
          },
        });
      }
    });
  } catch {
    return { erros: ["Falha ao concluir. Nada foi salvo — tente novamente."] };
  }
  return { erros: [], clienteId: passo.clienteId };
}

/**
 * Marca o próximo passo da empresa (substitui o que estiver aberto, como no registro). Empresa
 * marcada "não contatar" não recebe passo: quem pediu para parar não é procurado.
 */
export async function agendarProximoPasso(
  _autor: Autor,
  entrada: { clienteId: string; passo: PassoEntrada },
): Promise<Resultado & { substituido?: string | null }> {
  const empresa = await prisma.cliente.findUnique({
    where: { id: entrada.clienteId },
    include: { proximosPassos: { where: { concluidoEm: null, oportunidadeId: null } } },
  });
  if (!empresa) return { erros: ["Empresa não encontrada."] };
  if (empresa.naoContatar) return { erros: ["Esta empresa está marcada como \"não contatar\"."] };
  const erros = validarPasso(entrada.passo, hojeEmSaoPaulo());
  if (erros.length > 0) return { erros };
  if (!(await responsavelValido(entrada.passo.responsavelId))) return { erros: ["O responsável escolhido não pode receber tarefas."] };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, oportunidadeId: null, concluidoEm: null }, data: { concluidoEm: new Date() } });
      await tx.proximoPasso.create({
        data: {
          clienteId: empresa.id,
          acao: entrada.passo.acao.trim(),
          prazo: comoData(entrada.passo.prazo),
          responsavelId: entrada.passo.responsavelId,
        },
      });
    });
  } catch {
    return { erros: ["Falha ao agendar. Nada foi salvo — tente novamente."] };
  }
  return { erros: [], substituido: empresa.proximosPassos[0]?.acao ?? null };
}
