import { prisma } from "@/lib/prisma";

const LIMITE = 100;

// Linha de prospecção (ADR-015, fase 1). A do assistente não aparece aqui: ela fala com o
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
        mensagens: { orderBy: { ocorridoEm: "desc" }, take: 1, select: { direcao: true, tipo: true, texto: true } },
        _count: { select: { mensagens: true } },
      },
    }),
    // Mensagens de contatos que o WhatsApp esconde atrás de um identificador interno.
    prisma.eventoWhatsapp.count({ where: { linha: "PROSPECCAO", resultado: { startsWith: "sem_numero" } } }),
  ]);
  return { conversas, semTelefone, limite: LIMITE };
}
