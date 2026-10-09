"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { compararCampos } from "@/domain/auditoria/evento";

export type DadosTransportadora = {
  id: string;
  nome: string;
  metodo: "SSW" | "MANUAL" | "NAO_MAPEADA";
  contato: string;
  urlPublica: string;
  observacao: string;
};

const METODOS = ["SSW", "MANUAL", "NAO_MAPEADA"] as const;

export async function atualizarTransportadora(dados: DadosTransportadora): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (usuario.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode alterar transportadoras."] };

  const nome = dados.nome.trim();
  if (!nome) return { erros: ["Escreva o nome da transportadora."] };
  if (!METODOS.includes(dados.metodo)) return { erros: ["Escolha como rastrear."] };
  const url = dados.urlPublica.trim();
  if (url && !/^https?:\/\//i.test(url)) return { erros: ["O site precisa começar com http:// ou https://"] };

  const antes = await prisma.transportadora.findUnique({ where: { id: dados.id } });
  if (!antes) return { erros: ["Transportadora não encontrada."] };

  const depois = {
    nome,
    metodo: dados.metodo,
    contato: dados.contato.trim() || null,
    urlPublica: url || null,
    observacao: dados.observacao.trim() || null,
  };
  await prisma.$transaction([
    prisma.transportadora.update({
      where: { id: dados.id },
      // Voltar para SSW ou não mapeada zera as falhas: o cron tenta de novo.
      data: { ...depois, ...(dados.metodo !== antes.metodo ? { falhasSeguidas: 0, criadaAutomaticamente: false } : {}) },
    }),
    prisma.eventoAuditoria.createMany({
      data: compararCampos(
        "Transportadora",
        antes.id,
        usuario.id,
        { nome: antes.nome, metodo: antes.metodo, contato: antes.contato, urlPublica: antes.urlPublica, observacao: antes.observacao },
        depois,
      ),
    }),
  ]);
  revalidatePath("/cadastros/transportadoras");
  revalidatePath("/rastreio");
  return { erros: [] };
}
