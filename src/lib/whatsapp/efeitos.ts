import type { Conversa, Mensagem, Prisma } from "@prisma/client";
import { decidirEfeitosDaEntrada } from "@/domain/mensagens/efeitos";
import type { ClassificacaoPorRegra } from "@/domain/mensagens/supressao";
import { resumoDoMovimento } from "@/domain/crm/funil";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";

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
