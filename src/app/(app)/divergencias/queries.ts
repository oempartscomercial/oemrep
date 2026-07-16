import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas, podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { estaCritico } from "@/domain/chamado/inatividade";
import { obterParametroNumero } from "@/lib/parametros";

export async function buscarContextoAberturaChamado(notaFiscalId: string, usuario: UsuarioSessao) {
  const notaFiscal = await prisma.notaFiscal.findUnique({
    where: { id: notaFiscalId },
    include: { itensFaturados: { include: { itemPedido: { include: { pedido: true } } } } },
  });
  if (!notaFiscal) return null;

  const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return null;

  const motivos = await prisma.motivoChamado.findMany({ orderBy: { nome: "asc" } });

  return { notaFiscal, motivos };
}

export async function buscarChamadosPermitidos(usuario: UsuarioSessao) {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const prazoDias = await obterParametroNumero("prazo_chamado_critico_dias", 30);

  const chamados = await prisma.chamado.findMany({
    where: fabricasPermitidas
      ? { notaFiscal: { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } } }
      : {},
    include: {
      notaFiscal: true,
      motivo: true,
      eventos: { orderBy: { criadoEm: "desc" }, take: 1 },
    },
    orderBy: { criadoEm: "desc" },
  });

  const agora = new Date();
  return chamados
    .map((chamado) => {
      // Salvaguarda: todo chamado nasce com um EventoChamado (abrirChamado), então
      // eventos[0] deveria sempre existir; o fallback evita quebrar a fila caso
      // esse invariante seja violado (ex.: dado corrompido).
      const dataUltimoEvento = chamado.eventos[0]?.criadoEm ?? chamado.criadoEm;
      return {
        ...chamado,
        critico: chamado.estado !== "RESOLVIDO" && estaCritico(dataUltimoEvento, agora, prazoDias),
      };
    })
    .sort((a, b) => {
      if (a.critico !== b.critico) return a.critico ? -1 : 1;
      return b.criadoEm.getTime() - a.criadoEm.getTime();
    });
}

export async function buscarChamadoComPermissao(id: string, usuario: UsuarioSessao) {
  const chamado = await prisma.chamado.findUnique({
    where: { id },
    include: {
      notaFiscal: true,
      motivo: true,
      itensAfetados: { include: { itemPedido: true } },
      eventos: { orderBy: { criadoEm: "desc" }, include: { usuario: true } },
    },
  });
  if (!chamado) return null;

  const fabricaId = await obterFabricaIdDaNotaFiscal(chamado.notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return null;

  return chamado;
}
