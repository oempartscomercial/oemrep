import { prisma } from "@/lib/prisma";
import { statusSugerido, ultimaOcorrencia } from "@/domain/rastreio/ocorrencia";
import { transicaoRastreioValida, type StatusRastreio } from "@/domain/nfe/rastreio";
import { consultarSsw, type ResultadoConsulta } from "./ssw";

export type Consultar = (chave: string) => Promise<ResultadoConsulta>;

export type ResultadoAtualizacao =
  | { nota: string; situacao: "atualizada"; status: StatusRastreio; mudouStatus: boolean; ocorrencia: string | null }
  | { nota: string; situacao: "nao-encontrada" | "falhou" | "ignorada"; motivo: string };

/** Quantos "não encontrada" seguidos até a transportadora deixar de ser tentada no SSW. */
export const FALHAS_PARA_DESISTIR_DO_SSW = 3;

/**
 * Consulta a transportadora de UMA nota e grava o que ela disse: a última ocorrência, a
 * previsão de entrega e, quando a ocorrência pede, um evento de rastreio automático com a
 * mudança de status. Extravio nunca é automático (precisa de gente confirmando).
 *
 * Transportadora NAO_MAPEADA também é tentada no SSW — é o jeito de descobrir sozinho:
 * respondeu, vira SSW. Depois de algumas notas sem resposta, para de tentar.
 */
export async function atualizarRastreioDaNota(notaFiscalId: string, consultar: Consultar = consultarSsw): Promise<ResultadoAtualizacao> {
  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaFiscalId }, include: { transportadora: true } });
  if (!nota) return { nota: notaFiscalId, situacao: "ignorada", motivo: "Nota não encontrada." };
  const t = nota.transportadora;
  if (t?.metodo === "MANUAL") return { nota: nota.numero, situacao: "ignorada", motivo: "Transportadora sem rastreio automático." };
  if (t?.metodo === "NAO_MAPEADA" && t.falhasSeguidas >= FALHAS_PARA_DESISTIR_DO_SSW) {
    return { nota: nota.numero, situacao: "ignorada", motivo: "Transportadora ainda não mapeada." };
  }
  if (nota.status !== "TRANSITO" && nota.status !== "AGENDADO") {
    return { nota: nota.numero, situacao: "ignorada", motivo: "Nota já saiu do trânsito." };
  }

  const agora = new Date();
  const r = await consultar(nota.chaveAcesso);

  if (!r.ok || !r.encontrado) {
    await prisma.notaFiscal.update({ where: { id: nota.id }, data: { rastreioFalhas: { increment: 1 }, rastreioAtualizadoEm: agora } });
    if (t) {
      await prisma.transportadora.update({
        where: { id: t.id },
        data: { ultimaConsultaEm: agora, ...(r.ok ? { falhasSeguidas: { increment: 1 } } : {}) },
      });
    }
    return r.ok
      ? { nota: nota.numero, situacao: "nao-encontrada", motivo: "A transportadora não tem esta nota no SSW." }
      : { nota: nota.numero, situacao: "falhou", motivo: r.erro };
  }

  const ultima = ultimaOcorrencia(r.ocorrencias);
  const sugerido = statusSugerido(r.ocorrencias);
  const atual = nota.status as StatusRastreio;
  const mudar = sugerido && sugerido !== atual && transicaoRastreioValida(atual, sugerido) ? sugerido : null;

  await prisma.$transaction(async (tx) => {
    await tx.notaFiscal.update({
      where: { id: nota.id },
      data: {
        ultimaOcorrencia: ultima?.descricao ?? null,
        ultimaOcorrenciaEm: ultima?.data ?? null,
        previsaoEntrega: r.previsaoEntrega ?? nota.previsaoEntrega,
        rastreioAtualizadoEm: agora,
        rastreioFalhas: 0,
        ...(mudar ? { status: mudar } : {}),
      },
    });
    if (mudar) {
      await tx.eventoRastreio.create({
        data: {
          notaFiscalId: nota.id,
          statusAnterior: atual,
          status: mudar,
          observacao: ultima?.descricao ?? null,
          local: ultima?.local ?? null,
          dataEvento: ultima?.data ?? agora,
          origem: "AUTOMATICO",
        },
      });
    }
    if (t) {
      await tx.transportadora.update({
        where: { id: t.id },
        data: {
          ultimaConsultaEm: agora,
          ultimaConsultaOk: agora,
          falhasSeguidas: 0,
          // Respondeu no SSW: está mapeada.
          ...(t.metodo === "NAO_MAPEADA" ? { metodo: "SSW" } : {}),
        },
      });
    }
  });

  return { nota: nota.numero, situacao: "atualizada", status: mudar ?? atual, mudouStatus: !!mudar, ocorrencia: ultima?.descricao ?? null };
}

/** Pausa entre consultas: o SSW aceita 20 por segundo; ficamos bem abaixo. */
const PAUSA_MS = 150;

/** Todas as notas em trânsito ou agendadas, uma de cada vez. Usado pelo cron diário. */
export async function atualizarRastreiosEmAberto(consultar: Consultar = consultarSsw, pausaMs = PAUSA_MS) {
  const notas = await prisma.notaFiscal.findMany({
    where: { status: { in: ["TRANSITO", "AGENDADO"] }, OR: [{ transportadoraId: null }, { transportadora: { metodo: { not: "MANUAL" } } }] },
    select: { id: true },
    orderBy: { rastreioAtualizadoEm: { sort: "asc", nulls: "first" } },
    take: 300,
  });
  const resultados: ResultadoAtualizacao[] = [];
  for (const n of notas) {
    resultados.push(await atualizarRastreioDaNota(n.id, consultar));
    if (pausaMs > 0) await new Promise((ok) => setTimeout(ok, pausaMs));
  }
  return {
    consultadas: resultados.length,
    atualizadas: resultados.filter((r) => r.situacao === "atualizada").length,
    mudaramStatus: resultados.filter((r) => r.situacao === "atualizada" && r.mudouStatus).length,
    naoEncontradas: resultados.filter((r) => r.situacao === "nao-encontrada").length,
    falharam: resultados.filter((r) => r.situacao === "falhou").length,
  };
}
