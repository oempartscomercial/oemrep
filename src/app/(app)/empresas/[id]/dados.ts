import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import { numeroDoContato } from "@/domain/crm/contato";

// Consultas da ficha, uma por bloco da tela. Cada bloco chega em streaming (Suspense) e as
// consultas correm em paralelo; antes era uma consulta só com tudo aninhado, seguida de
// mais três em sequência, e a ficha inteira esperava a mais lenta.
// O `cache` garante uma ida ao banco por requisição mesmo quando dois blocos pedem o mesmo.

export const buscarCabecalho = cache((id: string) =>
  prisma.cliente.findUnique({
    where: { id },
    select: {
      id: true,
      nomeFantasia: true,
      cnpj: true,
      situacao: true,
      cidade: true,
      uf: true,
      site: true,
      grupo: true,
      origem: true,
      observacoes: true,
      naoContatar: true,
      criadoEm: true,
      fabricas: { select: { fabricaId: true, fabrica: { select: { nome: true } } }, orderBy: { fabrica: { nome: "asc" } } },
      proximosPassos: {
        where: { concluidoEm: null, oportunidadeId: null },
        orderBy: { prazo: "asc" },
        take: 1,
        select: { id: true, acao: true, prazo: true, responsavel: { select: { id: true, nome: true } } },
      },
    },
  }),
);

export const listarFabricas = cache(() => prisma.fabrica.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, ativo: true } }));

export const buscarContatos = cache(async (clienteId: string) => {
  const contatos = await prisma.contato.findMany({
    where: { clienteId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, funcao: true, canal: true, valor: true, fonte: true, observacoes: true, naoContatar: true, origemContato: true },
  });
  return contatos;
});

/** Contato com conversa não troca de número (a conversa é do número): a ligada a ele ou a solta com o mesmo número. */
export async function contatosComConversa(clienteId: string, contatos: { id: string; canal: string; valor: string }[]): Promise<string[]> {
  const numeros = contatos.map((c) => numeroDoContato(c.canal, c.valor)).filter((n): n is string => n !== null);
  const conversas = await prisma.conversa.findMany({
    where: { linha: "PROSPECCAO", OR: [{ clienteId }, ...(numeros.length ? [{ numero: { in: numeros } }] : [])] },
    select: { numero: true, contatoId: true },
  });
  const comConversa = new Set(conversas.map((c) => c.contatoId).filter(Boolean));
  const numerosComConversa = new Set(conversas.map((c) => c.numero));
  return contatos.filter((c) => comConversa.has(c.id) || numerosComConversa.has(numeroDoContato(c.canal, c.valor) ?? "")).map((c) => c.id);
}

/** WhatsApp (ADR-015): as 50 mensagens mais recentes de cada número ligado à empresa. */
export const buscarConversas = cache((clienteId: string) =>
  prisma.conversa.findMany({
    where: { clienteId },
    orderBy: { ultimaMensagemEm: "desc" },
    select: {
      id: true,
      numero: true,
      contatoId: true,
      nomeNoWhatsapp: true,
      contato: { select: { nome: true, naoContatar: true, origemContato: true } },
      mensagens: { orderBy: { ocorridoEm: "desc" }, take: 50 },
      _count: { select: { mensagens: true } },
    },
  }),
);

export function buscarInteracoes(clienteId: string) {
  return prisma.interacao.findMany({
    where: { clienteId },
    orderBy: { data: "desc" },
    take: 100,
    select: {
      id: true,
      data: true,
      canal: true,
      comQuem: true,
      resumo: true,
      resultado: true,
      origem: true,
      usuario: { select: { nome: true } },
      oportunidade: { select: { fabrica: { select: { nome: true } } } },
    },
  });
}

export const buscarPedidos = cache((clienteId: string, usuario: UsuarioSessao) => {
  const permitidas = filtroFabricasPermitidas(usuario);
  return prisma.pedido.findMany({
    where: { clienteId, ...(permitidas ? { fabricaId: { in: permitidas } } : {}) },
    orderBy: { criadoEm: "desc" },
    take: 50,
    select: {
      id: true,
      numero: true,
      semNumero: true,
      estado: true,
      criadoEm: true,
      dataPedido: true,
      valorTotalDeclarado: true,
      fabrica: { select: { nome: true } },
      itens: { select: { quantidadePedida: true, valorUnitario: true } },
    },
  });
});

/** Histórico da planilha: linhas suspeitas de duplicidade ficam fora das somas (ADR-013 §5). */
export async function buscarHistorico(clienteId: string, usuario: UsuarioSessao) {
  const permitidas = filtroFabricasPermitidas(usuario);
  const [grupos, fabricas] = await Promise.all([
    prisma.pedidoHistorico.groupBy({
      by: ["fabricaId"],
      where: { clienteId, suspeitaDuplicidade: false, tipo: "PEDIDO", ...(permitidas ? { fabricaId: { in: permitidas } } : {}) },
      _sum: { valor: true },
      _count: true,
      _max: { data: true },
    }),
    listarFabricas(),
  ]);
  const nome = new Map(fabricas.map((f) => [f.id, f.nome]));
  return grupos
    .map((h) => ({ fabrica: nome.get(h.fabricaId) ?? "—", pedidos: h._count, valor: Number(h._sum.valor ?? 0), ultimo: h._max.data }))
    .sort((a, b) => b.valor - a.valor);
}

export function buscarOportunidades(clienteId: string) {
  return prisma.oportunidade.findMany({
    where: { clienteId },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      tipo: true,
      etapa: true,
      motivoPerda: true,
      fabrica: { select: { nome: true } },
      proximosPassos: { where: { concluidoEm: null }, orderBy: { prazo: "asc" }, take: 1, select: { id: true, acao: true, prazo: true, responsavel: { select: { nome: true } } } },
    },
  });
}
