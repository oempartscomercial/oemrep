"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado, type UsuarioSessao } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { compararCampos } from "@/domain/auditoria/evento";
import type { CanalContato } from "@prisma/client";
import { normalizarTelefone } from "@/domain/mensagens/telefone";
import { chaveDuplicidade, numeroDoContato, validarContato } from "@/domain/crm/contato";
import { tipoDeEnvioSugerido, validarRascunho, rascunhoDeFollowUp, rascunhoDePrimeiroContato, type TipoEnvio } from "@/domain/mensagens/rascunho";
import { verificarEnvio, type Bloqueio } from "@/domain/mensagens/envio";
import { despachar, lerLimites, type ResultadoDoDespacho } from "@/lib/whatsapp/despachar";

// Todo envio passa por aqui em quatro passos: preparar (rascunho), aprovar (uma pessoa),
// despachar (proteções fixas) e, se não saiu, tentar de novo ou cancelar. A IA não aprova.

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SEM_PERMISSAO = "Você não tem permissão para acessar o CRM.";
const ORIGENS = ["PUBLICADO_PELA_EMPRESA", "INDICACAO", "BASE_PROFISSIONAL", "RELACIONAMENTO"] as const;

export type Resultado = { erros: string[] };
export type ResultadoDoRascunho = Resultado & { avisos?: string[]; id?: string };
export type ResultadoDaAprovacao = Resultado & { status?: ResultadoDoDespacho["status"]; motivo?: string };

async function sessaoCrm(): Promise<{ usuario: UsuarioSessao } | { erro: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: SEM_SESSAO };
  if (!podeVerCrm(usuario)) return { erro: SEM_PERMISSAO };
  return { usuario };
}

function revalidar(clienteId: string | null) {
  revalidatePath("/conversas");
  revalidatePath("/empresas");
  revalidatePath("/");
  if (clienteId) revalidatePath(`/empresas/${clienteId}`);
}

const PENDENTES = ["RASCUNHO", "APROVADA"] as const;

export async function prepararMensagem(entrada: { contatoId: string; texto: string }): Promise<ResultadoDoRascunho> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };

  const contato = await prisma.contato.findUnique({ where: { id: entrada.contatoId } });
  if (!contato) return { erros: ["Contato não encontrado."] };
  const numero = normalizarTelefone(contato.valor);
  if (!numero) return { erros: ["O número deste contato não é um telefone válido."] };

  const existente = await prisma.conversa.findUnique({ where: { linha_numero: { linha: "PROSPECCAO", numero } } });
  if (existente?.clienteId && existente.clienteId !== contato.clienteId) return { erros: ["Este número já está ligado a outra empresa."] };

  const historico = existente
    ? await prisma.mensagem.findMany({ where: { conversaId: existente.id }, select: { direcao: true, status: true, ocorridoEm: true } })
    : [];
  if (existente && (await prisma.mensagem.count({ where: { conversaId: existente.id, direcao: "SAIDA", status: { in: [...PENDENTES] } } })) > 0) {
    return { erros: ["Já existe uma mensagem pendente para este contato. Edite ou cancele a anterior."] };
  }

  const tipo = tipoDeEnvioSugerido(historico);
  const { erros, avisos } = validarRascunho(entrada.texto, tipo);
  if (erros.length > 0) return { erros, avisos };

  const conversa = existente
    ? existente.clienteId
      ? existente
      : await prisma.conversa.update({ where: { id: existente.id }, data: { clienteId: contato.clienteId, contatoId: contato.id, motivoSemVinculo: null } })
    : await prisma.conversa.create({
        data: { linha: "PROSPECCAO", numero, clienteId: contato.clienteId, contatoId: contato.id, ultimaMensagemEm: new Date() },
      });

  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId: conversa.id,
      linha: "PROSPECCAO",
      direcao: "SAIDA",
      origem: "PLATAFORMA",
      tipo: "TEXTO",
      texto: entrada.texto.trim(),
      ocorridoEm: new Date(),
      status: "RASCUNHO",
      tipoEnvio: tipo,
      criadaPorId: sessao.usuario.id,
    },
  });
  revalidar(contato.clienteId);
  return { erros: [], avisos, id: mensagem.id };
}

export async function editarRascunho(entrada: { id: string; texto: string }): Promise<ResultadoDoRascunho> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const m = await prisma.mensagem.findUnique({ where: { id: entrada.id }, include: { conversa: true } });
  if (!m || m.direcao !== "SAIDA" || m.status !== "RASCUNHO" || !m.tipoEnvio) return { erros: ["Só dá para editar um rascunho."] };
  const { erros, avisos } = validarRascunho(entrada.texto, m.tipoEnvio);
  if (erros.length > 0) return { erros, avisos };
  await prisma.mensagem.update({ where: { id: m.id }, data: { texto: entrada.texto.trim() } });
  revalidar(m.conversa.clienteId);
  return { erros: [], avisos, id: m.id };
}

/** A pessoa aprova; só depois disso o despacho aplica as proteções e envia (ou segura). */
export async function aprovarMensagem(entrada: { id: string }): Promise<ResultadoDaAprovacao> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const m = await prisma.mensagem.findUnique({ where: { id: entrada.id }, include: { conversa: true } });
  if (!m || m.direcao !== "SAIDA" || m.status !== "RASCUNHO" || !m.tipoEnvio || !m.texto) return { erros: ["Só dá para aprovar um rascunho."] };

  const { erros } = validarRascunho(m.texto, m.tipoEnvio);
  if (erros.length > 0) return { erros };

  const aprovada = await prisma.mensagem.updateMany({
    where: { id: m.id, status: "RASCUNHO" },
    data: { status: "APROVADA", aprovadaPorId: sessao.usuario.id, aprovadaEm: new Date(), motivoBloqueio: null },
  });
  if (aprovada.count === 0) return { erros: ["Só dá para aprovar um rascunho."] };

  const resultado = await despachar(m.id);
  revalidar(m.conversa.clienteId);
  return { erros: [], status: resultado.status, motivo: resultado.motivo };
}

/** Mensagem aprovada que ficou esperando (horário, linha, limite): tenta de novo agora. */
export async function tentarEnviar(entrada: { id: string }): Promise<ResultadoDaAprovacao> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const m = await prisma.mensagem.findUnique({ where: { id: entrada.id }, include: { conversa: true } });
  if (!m || m.direcao !== "SAIDA" || m.status !== "APROVADA") return { erros: ["Esta mensagem não está aprovada."] };
  const resultado = await despachar(m.id);
  revalidar(m.conversa.clienteId);
  return { erros: [], status: resultado.status, motivo: resultado.motivo };
}

export async function cancelarMensagem(entrada: { id: string }): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const m = await prisma.mensagem.findUnique({ where: { id: entrada.id }, include: { conversa: true } });
  if (!m || m.direcao !== "SAIDA" || !(PENDENTES as readonly string[]).includes(m.status)) {
    return { erros: ["Só dá para cancelar uma mensagem que ainda não foi enviada."] };
  }
  const r = await prisma.mensagem.updateMany({
    where: { id: m.id, status: { in: [...PENDENTES] } },
    data: { status: "CANCELADA", motivoBloqueio: `Cancelada por ${sessao.usuario.nome}.` },
  });
  if (r.count === 0) return { erros: ["Só dá para cancelar uma mensagem que ainda não foi enviada."] };
  revalidar(m.conversa.clienteId);
  return { erros: [] };
}

export async function definirOrigemContato(entrada: { contatoId: string; origem: string }): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  if (!(ORIGENS as readonly string[]).includes(entrada.origem)) return { erros: ["Escolha de onde veio o número."] };
  const contato = await prisma.contato.findUnique({ where: { id: entrada.contatoId } });
  if (!contato) return { erros: ["Contato não encontrado."] };
  await prisma.contato.update({ where: { id: contato.id }, data: { origemContato: entrada.origem as (typeof ORIGENS)[number] } });
  revalidar(contato.clienteId);
  return { erros: [] };
}

/** Só uma pessoa desfaz um "não contatar" (nunca a automação nem a IA). Fica registrado. */
export async function reativarContato(entrada: { contatoId: string }): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const contato = await prisma.contato.findUnique({ where: { id: entrada.contatoId }, include: { cliente: true } });
  if (!contato) return { erros: ["Contato não encontrado."] };
  const { usuario } = sessao;

  await prisma.$transaction(async (tx) => {
    await tx.contato.update({ where: { id: contato.id }, data: { naoContatar: false } });
    if (contato.cliente.naoContatar) {
      await tx.cliente.update({ where: { id: contato.clienteId }, data: { naoContatar: false } });
      await tx.eventoAuditoria.createMany({
        data: compararCampos("Cliente", contato.clienteId, usuario.id, { naoContatar: true }, { naoContatar: false }),
      });
    }
    await tx.interacao.create({
      data: {
        clienteId: contato.clienteId,
        data: new Date(),
        canal: "OUTRO",
        comQuem: contato.nome,
        origem: "USUARIO",
        usuarioId: usuario.id,
        resumo: `${usuario.nome} desfez o "não contatar" de ${contato.nome ?? "um contato"}.`,
      },
    });
  });
  revalidar(contato.clienteId);
  return { erros: [] };
}

export type EntradaContato = {
  clienteId: string;
  nome?: string;
  funcao?: string;
  canal: string;
  valor: string;
  fonte: string;
  observacoes?: string;
};

export type EntradaEdicaoContato = {
  contatoId: string;
  nome?: string;
  funcao?: string;
  canal: string;
  valor: string;
  fonte: string;
  observacoes?: string;
  /** Só muda se vier preenchido (a tela de cadastro ainda não pede este campo). */
  servePara?: string;
};

const textoOuNulo = (v?: string) => (v?.trim() ? v.trim() : null);
const semValores = (campos: Record<string, unknown>) => Object.fromEntries(Object.keys(campos).map((c) => [c, null]));
const MENSAGEM_CONVERSA = "Este número já tem conversa. Cadastre um contato novo em vez de trocar o número.";
const MENSAGEM_OUTRA_EMPRESA = "Este número já está ligado a outra empresa.";
const MENSAGEM_DUPLICADO = "Esta empresa já tem esse contato cadastrado.";

/** Cadastra um contato na empresa. Se o número já aparece numa conversa sem empresa, a conversa passa a ser dele. */
export async function criarContato(entrada: EntradaContato): Promise<Resultado & { id?: string }> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const cliente = await prisma.cliente.findUnique({ where: { id: entrada.clienteId }, select: { id: true } });
  if (!cliente) return { erros: ["Empresa não encontrada."] };

  const validacao = validarContato(entrada);
  const valor = validacao.valorNormalizado;
  if (validacao.erros.length > 0 || valor === undefined) return { erros: validacao.erros };
  const canal = entrada.canal as CanalContato;
  const numero = numeroDoContato(canal, valor);

  const outros = await prisma.contato.findMany({ where: { clienteId: cliente.id, canal }, select: { valor: true } });
  const chave = chaveDuplicidade(canal, valor);
  if (outros.some((o) => chaveDuplicidade(canal, o.valor) === chave)) return { erros: [MENSAGEM_DUPLICADO] };

  const conversa = numero ? await prisma.conversa.findUnique({ where: { linha_numero: { linha: "PROSPECCAO", numero } } }) : null;
  if (conversa?.clienteId && conversa.clienteId !== cliente.id) return { erros: [MENSAGEM_OUTRA_EMPRESA] };

  const dados = {
    nome: textoOuNulo(entrada.nome),
    funcao: textoOuNulo(entrada.funcao),
    canal,
    valor,
    fonte: entrada.fonte.trim(),
    observacoes: textoOuNulo(entrada.observacoes),
  };
  const { usuario } = sessao;
  const contato = await prisma.$transaction(async (tx) => {
    const novo = await tx.contato.create({ data: { ...dados, clienteId: cliente.id } });
    if (conversa && !conversa.clienteId) {
      await tx.conversa.update({ where: { id: conversa.id }, data: { clienteId: cliente.id, contatoId: novo.id, motivoSemVinculo: null } });
    }
    await tx.eventoAuditoria.createMany({ data: compararCampos("Contato", novo.id, usuario.id, semValores(dados), dados) });
    return novo;
  });
  revalidar(cliente.id);
  return { erros: [], id: contato.id };
}

/**
 * Edita um contato. Trocar o número (ou o canal) só vale se ainda não há conversa com ele;
 * trocar o número zera a origem, que era de outro número. "Não contatar" nunca muda aqui.
 */
export async function editarContato(entrada: EntradaEdicaoContato): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const atual = await prisma.contato.findUnique({ where: { id: entrada.contatoId } });
  if (!atual) return { erros: ["Contato não encontrado."] };

  const validacao = validarContato(entrada);
  const valor = validacao.valorNormalizado;
  if (validacao.erros.length > 0 || valor === undefined) return { erros: validacao.erros };
  const canal = entrada.canal as CanalContato;

  const mudouNumero = atual.canal !== canal || chaveDuplicidade(atual.canal, atual.valor) !== chaveDuplicidade(canal, valor);
  const numeroAtual = numeroDoContato(atual.canal, atual.valor);
  const numeroNovo = numeroDoContato(canal, valor);

  let conversaNova: { id: string; clienteId: string | null } | null = null;
  if (mudouNumero) {
    const comConversa = await prisma.conversa.findFirst({
      where: { OR: [{ contatoId: atual.id }, ...(numeroAtual ? [{ linha: "PROSPECCAO" as const, numero: numeroAtual }] : [])] },
      select: { id: true },
    });
    if (comConversa) return { erros: [MENSAGEM_CONVERSA] };

    if (numeroNovo) {
      conversaNova = await prisma.conversa.findUnique({ where: { linha_numero: { linha: "PROSPECCAO", numero: numeroNovo } }, select: { id: true, clienteId: true } });
      if (conversaNova?.clienteId && conversaNova.clienteId !== atual.clienteId) return { erros: [MENSAGEM_OUTRA_EMPRESA] };
    }

    const outros = await prisma.contato.findMany({ where: { clienteId: atual.clienteId, canal, id: { not: atual.id } }, select: { valor: true } });
    const chave = chaveDuplicidade(canal, valor);
    if (outros.some((o) => chaveDuplicidade(canal, o.valor) === chave)) return { erros: [MENSAGEM_DUPLICADO] };
  }

  const novos = {
    nome: textoOuNulo(entrada.nome),
    funcao: textoOuNulo(entrada.funcao),
    canal,
    valor: mudouNumero ? valor : atual.valor,
    fonte: entrada.fonte.trim(),
    observacoes: textoOuNulo(entrada.observacoes),
    ...(entrada.servePara !== undefined ? { servePara: textoOuNulo(entrada.servePara) } : {}),
    origemContato: mudouNumero ? null : atual.origemContato,
  };
  const antes: Record<string, unknown> = {
    nome: atual.nome,
    funcao: atual.funcao,
    canal: atual.canal,
    valor: atual.valor,
    servePara: atual.servePara,
    fonte: atual.fonte,
    observacoes: atual.observacoes,
    origemContato: atual.origemContato,
  };
  const { usuario } = sessao;
  await prisma.$transaction(async (tx) => {
    await tx.contato.update({ where: { id: atual.id }, data: novos });
    if (conversaNova && !conversaNova.clienteId) {
      await tx.conversa.update({
        where: { id: conversaNova.id },
        data: { clienteId: atual.clienteId, contatoId: atual.id, motivoSemVinculo: null },
      });
    }
    await tx.eventoAuditoria.createMany({ data: compararCampos("Contato", atual.id, usuario.id, antes, novos) });
  });
  revalidar(atual.clienteId);
  return { erros: [] };
}

export type ConsultaDeEnvio = {
  erros: string[];
  tipo?: TipoEnvio;
  textoSugerido?: string;
  bloqueios?: Bloqueio[];
};

/** Abre o compositor: o tipo da mensagem, um texto-base e o que impediria (ou seguraria) o envio agora. */
export async function consultarEnvio(entrada: { contatoId: string }): Promise<ConsultaDeEnvio> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const contato = await prisma.contato.findUnique({ where: { id: entrada.contatoId }, include: { cliente: true } });
  if (!contato) return { erros: ["Contato não encontrado."] };
  const numero = normalizarTelefone(contato.valor);

  const conversa = numero ? await prisma.conversa.findUnique({ where: { linha_numero: { linha: "PROSPECCAO", numero } } }) : null;
  const historico = conversa
    ? await prisma.mensagem.findMany({ where: { conversaId: conversa.id }, select: { direcao: true, status: true, texto: true, ocorridoEm: true } })
    : [];
  const tipo = tipoDeEnvioSugerido(historico);
  const textoSugerido = tipo === "PRIMEIRO_CONTATO" ? rascunhoDePrimeiroContato() : tipo === "FOLLOW_UP" ? rascunhoDeFollowUp() : "";

  // Não sabemos o estado da linha ao abrir a tela: aqui só aparecem as proteções sobre o contato e o momento.
  const verificacao = verificarEnvio({
    agora: new Date(),
    tipo,
    texto: textoSugerido,
    empresa: { situacao: contato.cliente.situacao, naoContatar: contato.cliente.naoContatar },
    contato: { naoContatar: contato.naoContatar, origemContato: contato.origemContato },
    numero,
    historico,
    primeirosContatosHoje: 0,
    limites: await lerLimites(),
    linha: "conectada",
  });
  return { erros: [], tipo, textoSugerido, bloqueios: verificacao.ok ? [] : verificacao.bloqueios };
}
