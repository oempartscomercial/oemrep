"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { extrairTotaisPedidos } from "@/domain/historico/pedidos";
import { extrairTotaisNFe } from "@/domain/historico/nfe";
import { resolverFabricas, type LinhaHistorico } from "@/domain/historico/resolucao";
import type { TotalMensal } from "@/domain/historico/tipos";
import { compararCampos } from "@/domain/auditoria/evento";

export type ResultadoAnalise = {
  erro?: string;
  linhas?: LinhaHistorico[];
  pendencias?: string[];
};

async function lerBuffer(arquivo: File | null): Promise<Buffer | null> {
  if (!arquivo || arquivo.size === 0) return null;
  return Buffer.from(await arquivo.arrayBuffer());
}

export async function analisarHistorico(formData: FormData): Promise<ResultadoAnalise> {
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.perfil !== "ADMIN") {
    return { erro: "Apenas ADMIN pode importar histórico." };
  }

  const bufferPedidos = await lerBuffer(formData.get("pedidos") as File | null);
  const bufferNfe = await lerBuffer(formData.get("nfe") as File | null);
  if (!bufferPedidos && !bufferNfe) {
    return { erro: "Selecione ao menos uma planilha (pedidos ou NFes)." };
  }

  let totaisPedidos: TotalMensal[] = [];
  let totaisNfe: TotalMensal[] = [];
  try {
    if (bufferPedidos) totaisPedidos = await extrairTotaisPedidos(bufferPedidos);
    if (bufferNfe) totaisNfe = await extrairTotaisNFe(bufferNfe);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao ler a planilha." };
  }

  const fabricas = await prisma.fabrica.findMany({ select: { id: true, nome: true } });
  const { linhas, pendencias } = resolverFabricas(totaisPedidos, totaisNfe, fabricas);

  return { linhas, pendencias };
}

export async function confirmarImportacaoHistorico(
  linhas: LinhaHistorico[],
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.perfil !== "ADMIN") {
    return { erros: ["Apenas ADMIN pode importar histórico."] };
  }
  if (linhas.length === 0) {
    return { erros: ["Nada para importar."] };
  }
  if (linhas.some((l) => !l.fabricaId)) {
    return { erros: ["Há fábricas não cadastradas. Resolva as pendências antes de importar."] };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const linha of linhas) {
        const anterior = await tx.historicoMensal.findUnique({
          where: {
            ano_mes_fabricaId_tipo: {
              ano: linha.ano,
              mes: linha.mes,
              fabricaId: linha.fabricaId,
              tipo: linha.tipo,
            },
          },
        });

        const registro = await tx.historicoMensal.upsert({
          where: {
            ano_mes_fabricaId_tipo: {
              ano: linha.ano,
              mes: linha.mes,
              fabricaId: linha.fabricaId,
              tipo: linha.tipo,
            },
          },
          create: {
            ano: linha.ano,
            mes: linha.mes,
            fabricaId: linha.fabricaId,
            tipo: linha.tipo,
            valor: linha.valor,
          },
          update: { valor: linha.valor },
        });

        const eventos = compararCampos(
          "HistoricoMensal",
          registro.id,
          usuario.id,
          { valor: anterior ? Number(anterior.valor) : null },
          { valor: linha.valor },
        );
        if (eventos.length > 0) {
          await tx.eventoAuditoria.createMany({ data: eventos });
        }
      }
    });
  } catch {
    return { erros: ["Falha ao gravar o histórico. Nada foi salvo — tente novamente."] };
  }

  revalidatePath("/");
  return { erros: [] };
}
