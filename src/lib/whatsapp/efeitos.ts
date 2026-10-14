import type { Conversa, Mensagem, Prisma } from "@prisma/client";
import { decidirEfeitosDaEntrada } from "@/domain/mensagens/efeitos";
import type { ClassificacaoPorRegra } from "@/domain/mensagens/supressao";
import { resumoDoMovimento } from "@/domain/crm/funil";
import { hojeEmSaoPaulo, proximoDiaUtil, somarDias } from "@/domain/crm/prazo";
import { diaEmSaoPaulo } from "@/domain/mensagens/exibicao";

// Aplica no CRM o que a mensagem recebida provoca (ADR-015 §5 e §6). Roda na mesma
// transação que grava a mensagem: se algo falha, nada fica pela metade e o transporte tenta
// de novo. Não há usuário logado aqui, então não grava auditoria de campo: o registro do que
// mudou e por quê fica na linha do tempo da empresa (Interacao com origem AUTOMACAO).

type Tx = Prisma.TransactionClient;

const trecho = (texto: string | null) => {
  const t = (texto ?? "").trim().replace(/\s+/g, " ");
  return t ? `«${t.length > 140 ? `${t.slice(0, 140)}…` : t}»` : "(sem texto)";
};

// Quem recebe a tarefa: quem aprovou a última mensagem nossa nesta conversa; senão o
// administrador ativo mais antigo. Sem ninguém, a mudança de etapa não acontece.
async function responsavelPadrao(tx: Tx, conversaId: string): Promise<string | null> {
  const ultima = await tx.mensagem.findFirst({
    where: { conversaId, direcao: "SAIDA", aprovadaPorId: { not: null } },
    orderBy: { ocorridoEm: "desc" },
    select: { aprovadaPor: { select: { id: true, ativo: true, perfil: true } } },
  });
  const aprovador = ultima?.aprovadaPor;
  if (aprovador && aprovador.ativo && aprovador.perfil !== "OPERADOR") return aprovador.id;
  const admin = await tx.usuario.findFirst({ where: { perfil: "ADMIN", ativo: true }, orderBy: { criadoEm: "asc" }, select: { id: true } });
  return admin?.id ?? null;
}

export async function aplicarEfeitosDaEntrada(
  tx: Tx,
  entrada: { conversa: Conversa; mensagem: Mensagem; classificacao: ClassificacaoPorRegra },
) {
  const { conversa, mensagem, classificacao } = entrada;
  if (!conversa.clienteId) return;
  const empresa = await tx.cliente.findUnique({ where: { id: conversa.clienteId } });
  if (!empresa) return;
  const contato = conversa.contatoId ? await tx.contato.findUnique({ where: { id: conversa.contatoId } }) : null;
  const quem = contato?.nome ?? conversa.nomeNoWhatsapp ?? "o contato";

  const efeitos = decidirEfeitosDaEntrada({ classificacao, situacaoEmpresa: empresa.situacao });

  if (efeitos.cancelar) {
    await tx.mensagem.updateMany({
      where: {
        conversaId: conversa.id,
        direcao: "SAIDA",
        status: { in: ["RASCUNHO", "APROVADA"] },
        ...(efeitos.cancelar === "cadencia" ? { tipoEnvio: { in: ["PRIMEIRO_CONTATO", "FOLLOW_UP"] } } : {}),
      },
      data: {
        status: "CANCELADA",
        motivoBloqueio: efeitos.cancelar === "tudo" ? "Cancelada: o contato pediu para não ser contatado." : "Cancelada: o contato respondeu.",
      },
    });
  }

  if (efeitos.marcarNaoContatar) {
    if (contato) await tx.contato.update({ where: { id: contato.id }, data: { naoContatar: true } });
    await tx.cliente.update({ where: { id: empresa.id }, data: { naoContatar: true } });
    await tx.interacao.create({
      data: {
        clienteId: empresa.id,
        data: new Date(),
        canal: "WHATSAPP",
        comQuem: quem,
        origem: "AUTOMACAO",
        resumo: `Pediu para não ser contatado pelo WhatsApp: ${trecho(mensagem.texto)}. O contato e a empresa foram marcados como "não contatar" (detectado automaticamente; quem decide desfazer é uma pessoa).`,
      },
    });
    return;
  }

  if (!efeitos.passo) return;
  const responsavelId = await responsavelPadrao(tx, conversa.id);
  if (!responsavelId) return;

  const acao = efeitos.passo === "responder" ? `Responder a ${quem}` : `Ver resposta de ${quem}: disse que não tem interesse`;
  await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, oportunidadeId: null, concluidoEm: null }, data: { concluidoEm: new Date() } });
  await tx.proximoPasso.create({
    data: { clienteId: empresa.id, acao, prazo: new Date(`${hojeEmSaoPaulo()}T00:00:00Z`), responsavelId },
  });

  if (efeitos.moverParaConversando) {
    await tx.cliente.update({ where: { id: empresa.id }, data: { situacao: "CONVERSANDO" } });
    await tx.interacao.create({
      data: {
        clienteId: empresa.id,
        data: new Date(),
        canal: "WHATSAPP",
        comQuem: quem,
        origem: "AUTOMACAO",
        resumo: `${resumoDoMovimento(empresa.situacao, "CONVERSANDO", {}, true)} Respondeu pelo WhatsApp: ${trecho(mensagem.texto)}.`,
      },
    });
  } else {
    await tx.interacao.create({
      data: {
        clienteId: empresa.id,
        data: new Date(),
        canal: "WHATSAPP",
        comQuem: quem,
        origem: "AUTOMACAO",
        resumo: `Respondeu pelo WhatsApp que não tem interesse (detectado automaticamente): ${trecho(mensagem.texto)}. A empresa não mudou de etapa: veja a resposta e decida.`,
      },
    });
  }
}

/** Quem tocou em "Já enviei" quando a mensagem saiu pelo celular, não pelo envio automático. */
export type EnvioManual = { usuarioId: string; nome: string };

// O que uma mensagem nossa que saiu provoca no CRM, venha do envio automático (despachar) ou do
// celular ("Já enviei"). Primeiro contato leva a empresa de "aprovada" para "em contato";
// follow-up renova o passo de acompanhar. Resposta não mexe em nada: o Rômulo cuida do passo
// dele. Movimento automático, com passo e linha do tempo, como nas demais automações do CRM.
// Roda dentro da transação de quem chama.
export async function aplicarEfeitosDoEnvio(tx: Tx, mensagemId: string, agora: Date, diasEntre: number, manual?: EnvioManual) {
  const m = await tx.mensagem.findUniqueOrThrow({ where: { id: mensagemId }, include: { conversa: { include: { cliente: true, contato: true } } } });
  const empresa = m.conversa.cliente;
  const responsavelId = m.aprovadaPorId;
  if (!empresa || !responsavelId || m.tipoEnvio === "RESPOSTA") return;

  const primeiro = m.tipoEnvio === "PRIMEIRO_CONTATO" && empresa.situacao === "APROVADA";
  const renova = m.tipoEnvio === "FOLLOW_UP" && empresa.situacao === "EM_CONTATO";
  if (!primeiro && !renova) return;

  const quem = m.conversa.contato?.nome ?? m.conversa.nomeNoWhatsapp ?? "o contato";
  const prazo = proximoDiaUtil(somarDias(diaEmSaoPaulo(agora), diasEntre));
  const meio = manual ? `pelo WhatsApp do celular de prospecção (${manual.nome} confirmou o envio)` : "pelo WhatsApp";
  await tx.proximoPasso.updateMany({ where: { clienteId: empresa.id, oportunidadeId: null, concluidoEm: null }, data: { concluidoEm: agora } });
  await tx.proximoPasso.create({
    data: { clienteId: empresa.id, acao: `Acompanhar resposta de ${quem}`, prazo: new Date(`${prazo}T00:00:00Z`), responsavelId },
  });
  if (primeiro) await tx.cliente.update({ where: { id: empresa.id }, data: { situacao: "EM_CONTATO" } });
  await tx.interacao.create({
    data: {
      clienteId: empresa.id,
      data: agora,
      canal: "WHATSAPP",
      comQuem: quem,
      // Envio pelo celular é ato de uma pessoa: a linha do tempo mostra quem confirmou.
      origem: manual ? "USUARIO" : "AUTOMACAO",
      usuarioId: manual?.usuarioId ?? null,
      resumo: primeiro
        ? `${resumoDoMovimento("APROVADA", "EM_CONTATO", {}, true)} Primeira mensagem enviada ${meio}.`
        : `Follow-up enviado ${meio}.`,
    },
  });
}
