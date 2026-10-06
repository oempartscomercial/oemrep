"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado, type UsuarioSessao } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { compararCampos } from "@/domain/auditoria/evento";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";
import { etapaAtiva, resumoDoMovimento, validarMovimento, type DadosMovimento } from "@/domain/crm/funil";

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SEM_PERMISSAO = "Você não tem permissão para acessar o CRM.";

export type PassoEntrada = { acao: string; prazo: string; responsavelId: string };
export type Resultado = { erros: string[] };

const comoData = (dia: string) => new Date(`${dia}T00:00:00Z`);

async function sessaoCrm(): Promise<{ usuario: UsuarioSessao } | { erro: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: SEM_SESSAO };
  if (!podeVerCrm(usuario)) return { erro: SEM_PERMISSAO };
  return { usuario };
}

function revalidar(clienteId: string) {
  revalidatePath("/funis");
  revalidatePath("/empresas");
  revalidatePath(`/empresas/${clienteId}`);
  revalidatePath("/");
}

// Responsável precisa ser alguém que usa o CRM e está ativo.
async function responsavelValido(id: string) {
  const u = await prisma.usuario.findUnique({ where: { id } });
  return !!u && u.ativo && u.perfil !== "OPERADOR";
}

function validarPasso(passo: PassoEntrada, hoje: string): string[] {
  // Reaproveita a regra do funil: etapa ativa exige ação, data (não passada) e responsável.
  return validarMovimento({ de: "CANDIDATA", para: "APROVADA", naoContatar: false }, { proximoPasso: passo }, hoje);
}

export async function moverEmpresa(entrada: {
  clienteId: string;
  para: string;
  proximoPasso?: PassoEntrada | null;
  retomadaEm?: string | null;
  motivo?: string | null;
  naoContatar?: boolean;
}): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const { usuario } = sessao;

  const empresa = await prisma.cliente.findUnique({ where: { id: entrada.clienteId } });
  if (!empresa) return { erros: ["Empresa não encontrada."] };

  const dados: DadosMovimento = { proximoPasso: entrada.proximoPasso, retomadaEm: entrada.retomadaEm, motivo: entrada.motivo };
  const erros = validarMovimento({ de: empresa.situacao, para: entrada.para, naoContatar: empresa.naoContatar }, dados, hojeEmSaoPaulo());
  if (erros.length > 0) return { erros };
  if (entrada.proximoPasso && !(await responsavelValido(entrada.proximoPasso.responsavelId))) {
    return { erros: ["O responsável escolhido não pode receber tarefas."] };
  }

  const para = entrada.para as typeof empresa.situacao;
  const marcarNaoContatar = entrada.para === "DESCARTADA" && entrada.naoContatar === true && !empresa.naoContatar;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.cliente.update({
        where: { id: empresa.id },
        data: { situacao: para, ...(marcarNaoContatar ? { naoContatar: true } : {}) },
      });
      // O passo antigo deixa de valer: o novo (ou nenhum) assume.
      await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, concluidoEm: null }, data: { concluidoEm: new Date() } });
      if (etapaAtiva(entrada.para) && entrada.proximoPasso) {
        await tx.proximoPasso.create({
          data: {
            clienteId: empresa.id,
            acao: entrada.proximoPasso.acao.trim(),
            prazo: comoData(entrada.proximoPasso.prazo),
            responsavelId: entrada.proximoPasso.responsavelId,
          },
        });
      }
      if (entrada.para === "PAUSADA" && entrada.retomadaEm) {
        await tx.proximoPasso.create({
          data: { clienteId: empresa.id, acao: "Retomar contato", prazo: comoData(entrada.retomadaEm), responsavelId: usuario.id },
        });
      }
      await tx.interacao.create({
        data: {
          clienteId: empresa.id,
          data: new Date(),
          canal: "OUTRO",
          resumo: resumoDoMovimento(empresa.situacao, entrada.para, dados),
          origem: "USUARIO",
          usuarioId: usuario.id,
        },
      });
      const eventos = [
        ...compararCampos("Cliente", empresa.id, usuario.id, { situacao: empresa.situacao }, { situacao: entrada.para }),
        ...(marcarNaoContatar ? compararCampos("Cliente", empresa.id, usuario.id, { naoContatar: false }, { naoContatar: true }) : []),
      ];
      if (eventos.length > 0) await tx.eventoAuditoria.createMany({ data: eventos });
    });
  } catch {
    return { erros: ["Falha ao mover a empresa. Nada foi salvo — tente novamente."] };
  }

  revalidar(empresa.id);
  return { erros: [] };
}

const CANAIS = ["WHATSAPP", "TELEFONE", "EMAIL", "VISITA", "REUNIAO", "OUTRO"] as const;

export async function registrarInteracao(entrada: {
  clienteId: string;
  canal: string;
  resumo: string;
  comQuem?: string | null;
  resultado?: string | null;
  proximoPasso?: PassoEntrada | null;
}): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const { usuario } = sessao;

  if (!(CANAIS as readonly string[]).includes(entrada.canal)) return { erros: ["Escolha como foi o contato."] };
  if (!entrada.resumo.trim()) return { erros: ["Conte em uma frase o que aconteceu."] };

  const empresa = await prisma.cliente.findUnique({
    where: { id: entrada.clienteId },
    include: { proximosPassos: { where: { concluidoEm: null } } },
  });
  if (!empresa) return { erros: ["Empresa não encontrada."] };

  // Toda empresa em andamento precisa de próximo passo (regra 4 do CLAUDE.md da pasta rep).
  if (etapaAtiva(empresa.situacao) && !entrada.proximoPasso && empresa.proximosPassos.length === 0) {
    return { erros: ["Diga qual é o próximo passo."] };
  }
  if (entrada.proximoPasso) {
    const erros = validarPasso(entrada.proximoPasso, hojeEmSaoPaulo());
    if (erros.length > 0) return { erros };
    if (!(await responsavelValido(entrada.proximoPasso.responsavelId))) return { erros: ["O responsável escolhido não pode receber tarefas."] };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.interacao.create({
        data: {
          clienteId: empresa.id,
          data: new Date(),
          canal: entrada.canal as (typeof CANAIS)[number],
          comQuem: entrada.comQuem?.trim() || null,
          resumo: entrada.resumo.trim(),
          resultado: entrada.resultado?.trim() || null,
          origem: "USUARIO",
          usuarioId: usuario.id,
        },
      });
      if (entrada.proximoPasso) {
        await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, concluidoEm: null }, data: { concluidoEm: new Date() } });
        await tx.proximoPasso.create({
          data: {
            clienteId: empresa.id,
            acao: entrada.proximoPasso.acao.trim(),
            prazo: comoData(entrada.proximoPasso.prazo),
            responsavelId: entrada.proximoPasso.responsavelId,
          },
        });
      }
    });
  } catch {
    return { erros: ["Falha ao registrar. Nada foi salvo — tente novamente."] };
  }

  revalidar(empresa.id);
  return { erros: [] };
}

/** Dá baixa no próximo passo. Empresa em andamento precisa já deixar o seguinte marcado. */
export async function concluirProximoPasso(entrada: { id: string; proximo?: PassoEntrada | null }): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };

  const passo = await prisma.proximoPasso.findUnique({ where: { id: entrada.id }, include: { cliente: true } });
  if (!passo || passo.concluidoEm) return { erros: ["Este próximo passo não está mais aberto."] };

  if (etapaAtiva(passo.cliente.situacao) && !entrada.proximo) return { erros: ["Diga qual é o próximo passo."] };
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

  revalidar(passo.clienteId);
  return { erros: [] };
}
