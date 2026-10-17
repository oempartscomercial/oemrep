import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { descreverMomento } from "@/domain/mensagens/agendamento";
import { ErroDeEnvio, obterTransporte, type EstadoDaLinha, type TransporteWhatsapp } from "./transporte";
import { aplicarEfeitosDoEnvio } from "./efeitos";
import { verificarMensagem } from "./verificacao";

export { JA_SAIU, lerLimites } from "./limites";

// Envio de mensagem JÁ aprovada por uma pessoa (ADR-015 §3). Aqui só se aplicam as proteções
// fixas e se chama o transporte; ninguém aprova nada neste arquivo.

// `codigos` só vem quando a mensagem continua aprovada esperando (códigos de verificarEnvio):
// quem agenda decide por eles, não pelo texto do motivo.
export type ResultadoDoDespacho = { status: "ENVIADA" | "APROVADA" | "CANCELADA" | "FALHOU" | "IGNORADA"; motivo?: string; codigos?: string[] };

export async function despachar(
  mensagemId: string,
  opcoes: { transporte?: TransporteWhatsapp; agora?: Date } = {},
): Promise<ResultadoDoDespacho> {
  const transporte = opcoes.transporte ?? (await obterTransporte());
  const agora = opcoes.agora ?? new Date();

  const mensagem = await prisma.mensagem.findUnique({
    where: { id: mensagemId },
    include: { conversa: { include: { cliente: true, contato: true } } },
  });
  if (!mensagem || mensagem.direcao !== "SAIDA" || mensagem.status !== "APROVADA") return { status: "IGNORADA" };
  // Agendada para mais tarde: ainda não é a hora. Quem quer antes usa "Enviar agora", que tira o agendamento.
  if (mensagem.agendadaPara && mensagem.agendadaPara > agora) {
    return { status: "APROVADA", motivo: `Agendada para ${descreverMomento(mensagem.agendadaPara)}.`, codigos: ["agendada"] };
  }
  const { conversa } = mensagem;

  const linha = await transporte.estado().catch((): EstadoDaLinha => "desconhecida");
  const avaliacao = await verificarMensagem(mensagem, { agora, linha });
  if (!avaliacao) return cancelar(mensagem.id, "A mensagem não está ligada a um contato cadastrado.");
  const { verificacao, limites } = avaliacao;

  if (!verificacao.ok) {
    const motivo = verificacao.bloqueios.map((b) => b.texto).join(" ");
    // Um bloqueio definitivo vence: a mensagem não deve sair nunca neste estado. Só espera se todos esperam.
    if (verificacao.bloqueios.some((b) => !b.espera)) return cancelar(mensagem.id, motivo);
    await prisma.mensagem.update({ where: { id: mensagem.id }, data: { motivoBloqueio: motivo } });
    return { status: "APROVADA", motivo, codigos: verificacao.bloqueios.map((b) => b.codigo) };
  }

  // Reserva a mensagem antes de chamar o transporte: dois despachos juntos não enviam duas vezes.
  const reserva = await prisma.mensagem.updateMany({
    where: { id: mensagem.id, status: "APROVADA" },
    data: { status: "ENVIANDO", motivoBloqueio: null },
  });
  if (reserva.count === 0) return { status: "IGNORADA" };

  try {
    const { idExterno } = await transporte.enviarTexto(conversa.numero, mensagem.texto!);
    try {
      // Se o eco chegou antes e já adotou a mensagem, não há mais nada ENVIANDO para atualizar.
      await prisma.mensagem.updateMany({
        where: { id: mensagem.id, status: "ENVIANDO" },
        data: { status: "ENVIADA", ...(idExterno ? { idExterno } : {}), enviadaEm: agora, ocorridoEm: agora, erro: null },
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
  await prisma.$transaction((tx) => aplicarEfeitosDoEnvio(tx, mensagem.id, agora, limites.diasEntreMensagens)).catch((erro) => {
    console.error("[whatsapp] mensagem enviada, mas os efeitos no CRM falharam", erro);
  });
  return { status: "ENVIADA" };
}

async function cancelar(id: string, motivo: string): Promise<ResultadoDoDespacho> {
  await prisma.mensagem.updateMany({ where: { id, status: "APROVADA" }, data: { status: "CANCELADA", motivoBloqueio: motivo } });
  return { status: "CANCELADA", motivo };
}
