import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";

export const EMPRESAS_POR_PAGINA = 50;
export const TIPOS_EMPRESA = ["todas", "clientes", "prospeccao"] as const;
export type TipoEmpresa = (typeof TIPOS_EMPRESA)[number];

export function lerTipoEmpresa(valor: string | undefined): TipoEmpresa {
  return TIPOS_EMPRESA.find((t) => t === valor) ?? "todas";
}

export function montarWhereEmpresas(tipo: TipoEmpresa, q: string): Prisma.ClienteWhereInput {
  const where: Prisma.ClienteWhereInput = {};
  if (tipo === "clientes") where.situacao = "CLIENTE";
  if (tipo === "prospeccao") where.situacao = { not: "CLIENTE" };
  const termo = q.trim();
  if (termo) {
    const digitos = termo.replace(/\D/g, "");
    where.OR = [
      { nomeFantasia: { contains: termo, mode: "insensitive" } },
      { cidade: { contains: termo, mode: "insensitive" } },
      { contatos: { some: { nome: { contains: termo, mode: "insensitive" } } } },
      ...(digitos.length >= 3 ? [{ cnpj: { contains: digitos } }] : []),
    ];
  }
  return where;
}

export async function listarEmpresas(tipo: TipoEmpresa, q: string, pagina: number) {
  const where = montarWhereEmpresas(tipo, q);
  const [total, empresas, contagem] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      orderBy: { nomeFantasia: "asc" },
      skip: (pagina - 1) * EMPRESAS_POR_PAGINA,
      take: EMPRESAS_POR_PAGINA,
      include: {
        fabricas: { include: { fabrica: true } },
        proximosPassos: { where: { concluidoEm: null }, orderBy: { prazo: "asc" }, take: 1, include: { responsavel: true } },
        interacoes: { orderBy: { data: "desc" }, take: 1 },
      },
    }),
    Promise.all([
      prisma.cliente.count({ where: montarWhereEmpresas("todas", q) }),
      prisma.cliente.count({ where: montarWhereEmpresas("clientes", q) }),
      prisma.cliente.count({ where: montarWhereEmpresas("prospeccao", q) }),
    ]),
  ]);
  return { total, empresas, contagem: { todas: contagem[0], clientes: contagem[1], prospeccao: contagem[2] } };
}

/** Quem pode receber tarefa do CRM (ativo e não operador). */
export function listarResponsaveis() {
  return prisma.usuario.findMany({
    where: { ativo: true, perfil: { not: "OPERADOR" } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

export async function buscarFicha(id: string, usuario: UsuarioSessao) {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const filtroFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};

  const empresa = await prisma.cliente.findUnique({
    where: { id },
    include: {
      fabricas: { include: { fabrica: true } },
      contatos: { orderBy: { criadoEm: "asc" } },
      interacoes: { orderBy: { data: "desc" }, take: 100, include: { usuario: true, oportunidade: { include: { fabrica: true } } } },
      proximosPassos: { where: { concluidoEm: null }, orderBy: { prazo: "asc" }, include: { responsavel: true } },
      oportunidades: { orderBy: { criadoEm: "desc" }, include: { fabrica: true } },
      // WhatsApp (ADR-015): as 50 mensagens mais recentes de cada número ligado à empresa.
      conversas: {
        orderBy: { ultimaMensagemEm: "desc" },
        include: {
          contato: { select: { nome: true } },
          mensagens: { orderBy: { ocorridoEm: "desc" }, take: 50 },
          _count: { select: { mensagens: true } },
        },
      },
      pedidos: {
        where: filtroFabrica,
        orderBy: { criadoEm: "desc" },
        take: 50,
        include: { fabrica: true, itens: { select: { quantidadePedida: true, valorUnitario: true } } },
      },
    },
  });
  if (!empresa) return null;

  // Histórico da planilha: linhas suspeitas de duplicidade ficam fora das somas (ADR-013 §5).
  const historico = await prisma.pedidoHistorico.groupBy({
    by: ["fabricaId"],
    where: { clienteId: id, suspeitaDuplicidade: false, tipo: "PEDIDO", ...filtroFabrica },
    _sum: { valor: true },
    _count: true,
    _max: { data: true },
  });
  const fabricas = await prisma.fabrica.findMany({ where: { id: { in: historico.map((h) => h.fabricaId) } } });
  const nomeFabrica = new Map(fabricas.map((f) => [f.id, f.nome]));

  return {
    empresa,
    historico: historico
      .map((h) => ({
        fabrica: nomeFabrica.get(h.fabricaId) ?? "—",
        pedidos: h._count,
        valor: Number(h._sum.valor ?? 0),
        ultimo: h._max.data,
      }))
      .sort((a, b) => b.valor - a.valor),
  };
}

export type BuscaGlobal = {
  empresas: { id: string; nome: string; detalhe: string }[];
  contatos: { id: string; empresaId: string; nome: string; detalhe: string }[];
  pedidos: { id: string; numero: string; detalhe: string }[];
};

export async function buscaGlobal(usuario: UsuarioSessao, q: string): Promise<BuscaGlobal> {
  const termo = q.trim();
  if (termo.length < 2) return { empresas: [], contatos: [], pedidos: [] };
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);

  const [empresas, contatos, pedidos] = await Promise.all([
    prisma.cliente.findMany({ where: montarWhereEmpresas("todas", termo), orderBy: { nomeFantasia: "asc" }, take: 6 }),
    prisma.contato.findMany({
      where: { nome: { contains: termo, mode: "insensitive" } },
      include: { cliente: true },
      take: 4,
    }),
    prisma.pedido.findMany({
      where: {
        numero: { contains: termo, mode: "insensitive" },
        ...(fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {}),
      },
      include: { fabrica: true, cliente: true },
      take: 4,
    }),
  ]);

  return {
    empresas: empresas.map((e) => ({ id: e.id, nome: e.nomeFantasia, detalhe: [e.cidade, e.uf].filter(Boolean).join("/") || e.situacao })),
    contatos: contatos.map((c) => ({ id: c.id, empresaId: c.clienteId, nome: c.nome ?? c.valor, detalhe: `${c.funcao ? `${c.funcao} · ` : ""}${c.cliente.nomeFantasia}` })),
    pedidos: pedidos.map((p) => ({ id: p.id, numero: p.numero ?? "S/N", detalhe: `${p.fabrica.nome} · ${p.cliente.nomeFantasia}` })),
  };
}
