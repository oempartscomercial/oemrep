import { prisma } from "@/lib/prisma";
import { verificarEnvio } from "@/domain/mensagens/envio";
import { lerLimites } from "@/lib/whatsapp/despachar";

const LIMITE = 100;
// Só o que de fato aconteceu na conversa: rascunho, falha e cancelada ficam de fora.
const REAIS = ["RECEBIDA", "ENVIANDO", "ENVIADA", "ENTREGUE", "LIDA"] as const;

// Linha de prospecção (ADR-015, fase 2). A do assistente não aparece aqui: ela fala com o
// Rômulo, não com empresas.
export async function listarConversas() {
  const [conversas, semTelefone] = await Promise.all([
    prisma.conversa.findMany({
      where: { linha: "PROSPECCAO" },
      orderBy: { ultimaMensagemEm: "desc" },
      take: LIMITE,
      include: {
        cliente: { select: { id: true, nomeFantasia: true } },
        contato: { select: { nome: true } },
        mensagens: { where: { status: { in: [...REAIS] } }, orderBy: { ocorridoEm: "desc" }, take: 1, select: { direcao: true, tipo: true, texto: true } },
        _count: { select: { mensagens: { where: { status: { in: [...REAIS] } } } } },
      },
    }),
    // Mensagens de contatos que o WhatsApp esconde atrás de um identificador interno.
    prisma.eventoWhatsapp.count({ where: { linha: "PROSPECCAO", resultado: { startsWith: "sem_numero" } } }),
  ]);
  return { conversas, semTelefone, limite: LIMITE };
}

/** Mensagens nossas que esperam uma pessoa: rascunhos para aprovar e aprovadas que ainda não saíram. */
export async function listarPendentes() {
  return prisma.mensagem.findMany({
    where: { linha: "PROSPECCAO", direcao: "SAIDA", status: { in: ["RASCUNHO", "APROVADA"] } },
    orderBy: { criadoEm: "asc" },
    include: { conversa: { include: { cliente: { select: { id: true, nomeFantasia: true } }, contato: { select: { id: true, nome: true } } } } },
  });
}

// Horário e linha seguram o envio na hora de enviar; não tiram a empresa da fila do dia.
const NAO_DESQUALIFICAM = new Set(["fora_do_horario", "linha_desconectada", "linha_desconhecida", "limite_diario"]);

/** Empresas "em contato" cujo próximo follow-up já pode ser preparado, pelas mesmas regras do envio. */
export async function listarFollowUpsDeHoje() {
  const [conversas, limites] = await Promise.all([
    prisma.conversa.findMany({
      where: { linha: "PROSPECCAO", contatoId: { not: null }, cliente: { situacao: "EM_CONTATO" } },
      include: {
        cliente: { select: { id: true, nomeFantasia: true, situacao: true, naoContatar: true } },
        contato: { select: { id: true, nome: true, naoContatar: true, origemContato: true } },
        mensagens: { select: { direcao: true, status: true, texto: true, ocorridoEm: true } },
      },
    }),
    lerLimites(),
  ]);
  const agora = new Date();
  return conversas.filter((c) => {
    if (!c.cliente || !c.contato) return false;
    if (c.mensagens.some((m) => m.direcao === "SAIDA" && (m.status === "RASCUNHO" || m.status === "APROVADA"))) return false;
    const r = verificarEnvio({
      agora,
      tipo: "FOLLOW_UP",
      texto: "",
      empresa: { situacao: c.cliente.situacao, naoContatar: c.cliente.naoContatar },
      contato: { naoContatar: c.contato.naoContatar, origemContato: c.contato.origemContato },
      numero: c.numero,
      historico: c.mensagens,
      primeirosContatosHoje: 0,
      limites,
      linha: "conectada",
    });
    return r.ok || r.bloqueios.every((b) => NAO_DESQUALIFICAM.has(b.codigo));
  });
}
