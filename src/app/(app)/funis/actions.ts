"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado, type UsuarioSessao } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { compararCampos } from "@/domain/auditoria/evento";
import type { DadosMovimento } from "@/domain/crm/funil";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";
import {
  etapaAtivaOp,
  ROTULO_TIPO_OP,
  resumoDoMovimentoOportunidade,
  validarMovimentoOportunidade,
  type TipoOportunidade,
} from "@/domain/crm/oportunidade";
import type { PassoEntrada, Resultado } from "../empresas/actions";

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SEM_PERMISSAO = "Você não tem permissão para acessar o CRM.";
const comoData = (dia: string) => new Date(`${dia}T00:00:00Z`);

async function sessaoCrm(): Promise<{ usuario: UsuarioSessao } | { erro: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: SEM_SESSAO };
  if (!podeVerCrm(usuario)) return { erro: SEM_PERMISSAO };
  return { usuario };
}

function revalidar(clienteId: string) {
  revalidatePath("/funis");
  revalidatePath(`/empresas/${clienteId}`);
  revalidatePath("/");
}

export async function criarOportunidade(entrada: { clienteId: string; fabricaId: string; tipo: string; observacoes?: string | null }): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const { usuario } = sessao;

  if (entrada.tipo !== "VENDER_FABRICA_NOVA" && entrada.tipo !== "REATIVAR") return { erros: ["Escolha o tipo da oportunidade."] };
  const tipo: TipoOportunidade = entrada.tipo;

  const [cliente, fabrica, vinculo, abertas] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: entrada.clienteId } }),
    prisma.fabrica.findUnique({ where: { id: entrada.fabricaId } }),
    prisma.clienteFabrica.findUnique({ where: { clienteId_fabricaId: { clienteId: entrada.clienteId, fabricaId: entrada.fabricaId } } }),
    prisma.oportunidade.count({ where: { clienteId: entrada.clienteId, fabricaId: entrada.fabricaId, etapa: { notIn: ["GANHA", "PERDIDA"] } } }),
  ]);
  if (!cliente) return { erros: ["Empresa não encontrada."] };
  if (!fabrica || !fabrica.ativo) return { erros: ["Fábrica não encontrada ou desativada."] };
  if (cliente.situacao !== "CLIENTE") return { erros: ["A carteira é só de clientes. Empresa em prospecção usa o funil de prospecção."] };
  if (tipo === "VENDER_FABRICA_NOVA" && vinculo) return { erros: [`${cliente.nomeFantasia} já compra ${fabrica.nome}. Para reativar, escolha "${ROTULO_TIPO_OP.REATIVAR}".`] };
  if (tipo === "REATIVAR" && !vinculo) return { erros: [`${cliente.nomeFantasia} nunca comprou ${fabrica.nome}. Escolha "${ROTULO_TIPO_OP.VENDER_FABRICA_NOVA}".`] };
  if (abertas > 0) return { erros: [`Já existe uma oportunidade aberta de ${cliente.nomeFantasia} com ${fabrica.nome}.`] };

  try {
    await prisma.$transaction(async (tx) => {
      const o = await tx.oportunidade.create({
        data: { clienteId: cliente.id, fabricaId: fabrica.id, tipo, observacoes: entrada.observacoes?.trim() || null, criadoPorId: usuario.id },
      });
      await tx.interacao.create({
        data: {
          clienteId: cliente.id,
          oportunidadeId: o.id,
          data: new Date(),
          canal: "OUTRO",
          resumo: `Oportunidade criada: ${fabrica.nome} (${ROTULO_TIPO_OP[tipo].toLowerCase()}).`,
          origem: "USUARIO",
          usuarioId: usuario.id,
        },
      });
      await tx.eventoAuditoria.createMany({ data: compararCampos("Oportunidade", o.id, usuario.id, {}, { etapa: o.etapa }) });
    });
  } catch {
    return { erros: ["Falha ao criar a oportunidade. Nada foi salvo — tente novamente."] };
  }

  revalidar(cliente.id);
  return { erros: [] };
}

export async function moverOportunidade(entrada: {
  id: string;
  para: string;
  proximoPasso?: PassoEntrada | null;
  retomadaEm?: string | null;
  motivo?: string | null;
}): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const { usuario } = sessao;

  const o = await prisma.oportunidade.findUnique({ where: { id: entrada.id }, include: { fabrica: true } });
  if (!o) return { erros: ["Oportunidade não encontrada."] };

  const dados: DadosMovimento = { proximoPasso: entrada.proximoPasso, retomadaEm: entrada.retomadaEm, motivo: entrada.motivo };
  const erros = validarMovimentoOportunidade(o.etapa, entrada.para, dados, hojeEmSaoPaulo());
  if (erros.length > 0) return { erros };

  if (entrada.proximoPasso) {
    const r = await prisma.usuario.findUnique({ where: { id: entrada.proximoPasso.responsavelId } });
    if (!r || !r.ativo || r.perfil === "OPERADOR") return { erros: ["O responsável escolhido não pode receber tarefas."] };
  }
  if (o.etapa === "PERDIDA") {
    const outras = await prisma.oportunidade.count({
      where: { clienteId: o.clienteId, fabricaId: o.fabricaId, id: { not: o.id }, etapa: { notIn: ["GANHA", "PERDIDA"] } },
    });
    if (outras > 0) return { erros: ["Já existe outra oportunidade aberta desse cliente com essa fábrica."] };
  }

  const para = entrada.para as typeof o.etapa;
  const perdida = entrada.para === "PERDIDA";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id: o.id },
        data: { etapa: para, motivoPerda: perdida ? entrada.motivo!.trim() : null, encerradaEm: perdida ? new Date() : null },
      });
      await tx.proximoPasso.updateMany({ where: { oportunidadeId: o.id, concluidoEm: null }, data: { concluidoEm: new Date() } });
      if (etapaAtivaOp(entrada.para) && entrada.proximoPasso) {
        await tx.proximoPasso.create({
          data: {
            clienteId: o.clienteId,
            oportunidadeId: o.id,
            acao: entrada.proximoPasso.acao.trim(),
            prazo: comoData(entrada.proximoPasso.prazo),
            responsavelId: entrada.proximoPasso.responsavelId,
          },
        });
      }
      if (entrada.para === "ADIADA" && entrada.retomadaEm) {
        await tx.proximoPasso.create({
          data: { clienteId: o.clienteId, oportunidadeId: o.id, acao: `Retomar ${o.fabrica.nome}`, prazo: comoData(entrada.retomadaEm), responsavelId: usuario.id },
        });
      }
      await tx.interacao.create({
        data: {
          clienteId: o.clienteId,
          oportunidadeId: o.id,
          data: new Date(),
          canal: "OUTRO",
          resumo: resumoDoMovimentoOportunidade(o.fabrica.nome, o.etapa, entrada.para, dados),
          origem: "USUARIO",
          usuarioId: usuario.id,
        },
      });
      await tx.eventoAuditoria.createMany({ data: compararCampos("Oportunidade", o.id, usuario.id, { etapa: o.etapa }, { etapa: entrada.para }) });
    });
  } catch {
    return { erros: ["Falha ao mover a oportunidade. Nada foi salvo — tente novamente."] };
  }

  revalidar(o.clienteId);
  return { erros: [] };
}
