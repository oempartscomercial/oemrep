import type { CanalContato, OrigemContato, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compararCampos } from "@/domain/auditoria/evento";
import { mesmoTelefone, normalizarTelefone } from "@/domain/mensagens/telefone";
import { chaveDuplicidade, numeroDoContato, validarContato } from "@/domain/crm/contato";

// Regras de cadastro de contato, usadas pela tela (server action) e pelo Claude (servidor MCP).

export const ORIGENS_CONTATO = ["PUBLICADO_PELA_EMPRESA", "INDICACAO", "BASE_PROFISSIONAL", "RELACIONAMENTO"] as const;

export type EntradaContato = {
  clienteId: string;
  nome?: string;
  funcao?: string;
  canal: string;
  valor: string;
  fonte: string;
  observacoes?: string;
  servePara?: string;
  /** De onde veio o número (ADR-015 §4). Sem origem, nenhuma mensagem sai para ele. */
  origemContato?: string | null;
};

export const textoOuNulo = (v?: string | null) => (v?.trim() ? v.trim() : null);
const semValores = (campos: Record<string, unknown>) => Object.fromEntries(Object.keys(campos).map((c) => [c, null]));

export const MENSAGEM_OUTRA_EMPRESA = "Este número já está ligado a outra empresa.";
const MENSAGEM_NAO_CONTATAR = "Este número está marcado como 'não contatar'. Reative o contato antes de cadastrá-lo de novo.";
export const MENSAGEM_DUPLICADO = "Esta empresa já tem esse contato cadastrado.";

/**
 * Antes de gravar um número: ele não pode estar em outra empresa (a conversa ficaria sem dono)
 * nem em contato desta empresa marcado "não contatar" (cadastrar de novo por outro canal
 * contornaria a supressão). Compara pelo número normalizado, em qualquer canal de telefone.
 */
export async function conflitoDoNumero(numero: string, clienteId: string, ignorarContatoId?: string): Promise<string | null> {
  const todos = await prisma.contato.findMany({
    where: { canal: { in: ["WHATSAPP", "TELEFONE"] }, ...(ignorarContatoId ? { id: { not: ignorarContatoId } } : {}) },
    select: { clienteId: true, valor: true, naoContatar: true },
  });
  const iguais = todos.filter((c) => {
    const n = normalizarTelefone(c.valor);
    return n !== null && mesmoTelefone(n, numero);
  });
  if (iguais.some((c) => c.clienteId !== clienteId)) return MENSAGEM_OUTRA_EMPRESA;
  if (iguais.some((c) => c.naoContatar)) return MENSAGEM_NAO_CONTATAR;
  return null;
}

export type ContatoPreparado = {
  clienteId: string;
  dados: {
    nome: string | null;
    funcao: string | null;
    canal: CanalContato;
    valor: string;
    fonte: string;
    observacoes: string | null;
    servePara: string | null;
    origemContato: OrigemContato | null;
  };
  /** Conversa sem empresa com o mesmo número: passa a ser deste contato. */
  conversaSoltaId: string | null;
};

/** Valida e normaliza um contato novo, sem gravar nada. */
export async function prepararNovoContato(entrada: EntradaContato): Promise<{ erros: string[] } | { erros: []; preparado: ContatoPreparado }> {
  const cliente = await prisma.cliente.findUnique({ where: { id: entrada.clienteId }, select: { id: true } });
  if (!cliente) return { erros: ["Empresa não encontrada."] };

  const validacao = validarContato(entrada);
  const valor = validacao.valorNormalizado;
  if (validacao.erros.length > 0 || valor === undefined) return { erros: validacao.erros };
  const origem = entrada.origemContato ?? null;
  if (origem && !(ORIGENS_CONTATO as readonly string[]).includes(origem)) return { erros: ["Escolha de onde veio o número."] };
  const canal = entrada.canal as CanalContato;
  const numero = numeroDoContato(canal, valor);

  const outros = await prisma.contato.findMany({ where: { clienteId: cliente.id, canal }, select: { valor: true } });
  const chave = chaveDuplicidade(canal, valor);
  if (outros.some((o) => chaveDuplicidade(canal, o.valor) === chave)) return { erros: [MENSAGEM_DUPLICADO] };

  const conversa = numero ? await prisma.conversa.findUnique({ where: { linha_numero: { linha: "PROSPECCAO", numero } } }) : null;
  if (conversa?.clienteId && conversa.clienteId !== cliente.id) return { erros: [MENSAGEM_OUTRA_EMPRESA] };
  const conflito = numero ? await conflitoDoNumero(numero, cliente.id) : null;
  if (conflito) return { erros: [conflito] };

  return {
    erros: [],
    preparado: {
      clienteId: cliente.id,
      dados: {
        nome: textoOuNulo(entrada.nome),
        funcao: textoOuNulo(entrada.funcao),
        canal,
        valor,
        fonte: entrada.fonte.trim(),
        observacoes: textoOuNulo(entrada.observacoes),
        servePara: textoOuNulo(entrada.servePara),
        origemContato: origem as OrigemContato | null,
      },
      conversaSoltaId: conversa && !conversa.clienteId ? conversa.id : null,
    },
  };
}

/** Grava o contato já preparado, com auditoria, dentro da transação de quem chama. */
export async function gravarNovoContato(tx: Prisma.TransactionClient, usuarioId: string, p: ContatoPreparado) {
  const novo = await tx.contato.create({ data: { ...p.dados, clienteId: p.clienteId } });
  if (p.conversaSoltaId) {
    await tx.conversa.update({ where: { id: p.conversaSoltaId }, data: { clienteId: p.clienteId, contatoId: novo.id, motivoSemVinculo: null } });
  }
  await tx.eventoAuditoria.createMany({ data: compararCampos("Contato", novo.id, usuarioId, semValores(p.dados), p.dados) });
  return novo;
}

/** Cadastra um contato na empresa. Se o número já aparece numa conversa sem empresa, a conversa passa a ser dele. */
export async function criarContato(usuarioId: string, entrada: EntradaContato): Promise<{ erros: string[]; id?: string }> {
  const r = await prepararNovoContato(entrada);
  if (!("preparado" in r)) return { erros: r.erros };
  const contato = await prisma.$transaction((tx) => gravarNovoContato(tx, usuarioId, r.preparado));
  return { erros: [], id: contato.id };
}
