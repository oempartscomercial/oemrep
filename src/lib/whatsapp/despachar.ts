import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterParametroNumero } from "@/lib/parametros";
import { verificarEnvio, type Limites } from "@/domain/mensagens/envio";
import { diaEmSaoPaulo } from "@/domain/mensagens/exibicao";
import { resumoDoMovimento } from "@/domain/crm/funil";
import { proximoDiaUtil, somarDias } from "@/domain/crm/prazo";
import { ErroDeEnvio, obterTransporte, type EstadoDaLinha, type TransporteWhatsapp } from "./transporte";

// Envio de mensagem JÁ aprovada por uma pessoa (ADR-015 §3). Aqui só se aplicam as proteções
// fixas e se chama o transporte; ninguém aprova nada neste arquivo.

export type ResultadoDoDespacho = { status: "ENVIADA" | "APROVADA" | "CANCELADA" | "FALHOU" | "IGNORADA"; motivo?: string };

const JA_SAIU = ["ENVIANDO", "ENVIADA", "ENTREGUE", "LIDA"] as const;

export async function lerLimites(): Promise<Limites> {
  const [horarioInicio, horarioFim, maxPrimeirosPorDia, diasEntreMensagens, maxTentativas] = await Promise.all([
    obterParametroNumero("whatsapp_horario_inicio", 8),
    obterParametroNumero("whatsapp_horario_fim", 18),
    obterParametroNumero("whatsapp_limite_primeiros_dia", 15),
    obterParametroNumero("whatsapp_dias_entre_mensagens", 3),
    obterParametroNumero("whatsapp_max_tentativas", 3),
  ]);
  return { horarioInicio, horarioFim, maxPrimeirosPorDia, diasEntreMensagens, maxTentativas };
}

export async function despachar(
  mensagemId: string,
  opcoes: { transporte?: TransporteWhatsapp; agora?: Date } = {},
): Promise<ResultadoDoDespacho> {
  const transporte = opcoes.transporte ?? obterTransporte();
  const agora = opcoes.agora ?? new Date();

  const mensagem = await prisma.mensagem.findUnique({
    where: { id: mensagemId },
    include: { conversa: { include: { cliente: true, contato: true } } },
  });
  if (!mensagem || mensagem.direcao !== "SAIDA" || mensagem.status !== "APROVADA") return { status: "IGNORADA" };
  const { conversa } = mensagem;
  if (!conversa.cliente || !conversa.contato || !mensagem.tipoEnvio || !mensagem.texto) {
    return cancelar(mensagem.id, "A mensagem não está ligada a um contato cadastrado.");
  }

  const [historico, limites, linha] = await Promise.all([
    prisma.mensagem.findMany({
      where: { conversaId: conversa.id, id: { not: mensagem.id } },
      select: { direcao: true, status: true, texto: true, ocorridoEm: true },
    }),
    lerLimites(),
    transporte.estado().catch((): EstadoDaLinha => "desconhecida"),
  ]);
  const inicioDoDia = new Date(`${diaEmSaoPaulo(agora)}T00:00:00-03:00`);
  const primeirosContatosHoje = await prisma.mensagem.count({
    where: { linha: mensagem.linha, tipoEnvio: "PRIMEIRO_CONTATO", status: { in: [...JA_SAIU] }, enviadaEm: { gte: inicioDoDia } },
  });

  const verificacao = verificarEnvio({
    agora,
    tipo: mensagem.tipoEnvio,
    texto: mensagem.texto,
    empresa: { situacao: conversa.cliente.situacao, naoContatar: conversa.cliente.naoContatar },
    contato: { naoContatar: conversa.contato.naoContatar, origemContato: conversa.contato.origemContato },
    numero: conversa.numero,
    historico: historico.map((h) => ({ direcao: h.direcao, status: h.status, texto: h.texto, ocorridoEm: h.ocorridoEm })),
    primeirosContatosHoje,
    limites,
    linha,
  });

  if (!verificacao.ok) {
    const motivo = verificacao.bloqueios.map((b) => b.texto).join(" ");
    // Um bloqueio definitivo vence: a mensagem não deve sair nunca neste estado. Só espera se todos esperam.
    if (verificacao.bloqueios.some((b) => !b.espera)) return cancelar(mensagem.id, motivo);
    await prisma.mensagem.update({ where: { id: mensagem.id }, data: { motivoBloqueio: motivo } });
    return { status: "APROVADA", motivo };
  }

  // Reserva a mensagem antes de chamar o transporte: dois despachos juntos não enviam duas vezes.
  const reserva = await prisma.mensagem.updateMany({
    where: { id: mensagem.id, status: "APROVADA" },
    data: { status: "ENVIANDO", motivoBloqueio: null },
  });
  if (reserva.count === 0) return { status: "IGNORADA" };

  try {
    const { idExterno } = await transporte.enviarTexto(conversa.numero, mensagem.texto);
    try {
      // Se o eco chegou antes e já adotou a mensagem, não há mais nada ENVIANDO para atualizar.
      await prisma.mensagem.updateMany({
        where: { id: mensagem.id, status: "ENVIANDO" },
        data: { status: "ENVIADA", idExterno, enviadaEm: agora, ocorridoEm: agora, erro: null },
      });
    } catch (erro) {
      // O eco já gravou esse id em outra linha: mantém a mensagem como enviada, sem o id.
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002")) throw erro;
      await prisma.mensagem.updateMany({ where: { id: mensagem.id, status: "ENVIANDO" }, data: { status: "ENVIADA", enviadaEm: agora, ocorridoEm: agora, erro: null } });
    }
  } catch (erro) {
    const certo = erro instanceof ErroDeEnvio && erro.certezaQueNaoEnviou;
    const base = erro instanceof Error ? erro.message : "Falha ao enviar.";
    const texto = certo ? base : `${base} Não sei se a mensagem saiu: confira no celular antes de tentar de novo.`;
    await prisma.mensagem.updateMany({ where: { id: mensagem.id, status: "ENVIANDO" }, data: { status: "FALHOU", erro: texto } });
    return { status: "FALHOU", motivo: texto };
  }

  // A mensagem já saiu; falha nos efeitos no CRM não a desfaz.
  await aplicarEfeitosDoEnvio(mensagem.id, agora, limites.diasEntreMensagens).catch((erro) => {
    console.error("[whatsapp] mensagem enviada, mas os efeitos no CRM falharam", erro);
  });
  return { status: "ENVIADA" };
}

async function cancelar(id: string, motivo: string): Promise<ResultadoDoDespacho> {
  await prisma.mensagem.updateMany({ where: { id, status: "APROVADA" }, data: { status: "CANCELADA", motivoBloqueio: motivo } });
  return { status: "CANCELADA", motivo };
}

// Primeiro contato leva a empresa de "aprovada" para "em contato"; follow-up renova o passo de
// acompanhar. Resposta não mexe em nada: o Rômulo cuida do passo dele. Movimento automático,
// com passo e linha do tempo, como nas demais automações do CRM.
async function aplicarEfeitosDoEnvio(mensagemId: string, agora: Date, diasEntre: number) {
  const m = await prisma.mensagem.findUniqueOrThrow({ where: { id: mensagemId }, include: { conversa: { include: { cliente: true, contato: true } } } });
  const empresa = m.conversa.cliente;
  const responsavelId = m.aprovadaPorId;
  if (!empresa || !responsavelId || m.tipoEnvio === "RESPOSTA") return;

  const primeiro = m.tipoEnvio === "PRIMEIRO_CONTATO" && empresa.situacao === "APROVADA";
  const renova = m.tipoEnvio === "FOLLOW_UP" && empresa.situacao === "EM_CONTATO";
  if (!primeiro && !renova) return;

  const quem = m.conversa.contato?.nome ?? m.conversa.nomeNoWhatsapp ?? "o contato";
  const prazo = proximoDiaUtil(somarDias(diaEmSaoPaulo(agora), diasEntre));
  await prisma.$transaction(async (tx) => {
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
        origem: "AUTOMACAO",
        resumo: primeiro
          ? `${resumoDoMovimento("APROVADA", "EM_CONTATO", {}, true)} Primeira mensagem enviada pelo WhatsApp.`
          : "Follow-up enviado pelo WhatsApp.",
      },
    });
  });
}
