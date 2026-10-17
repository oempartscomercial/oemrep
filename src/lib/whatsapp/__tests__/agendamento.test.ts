import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enviarAprovadas } from "../enviar-aprovadas";
import { despachar } from "../despachar";
import type { TransporteWhatsapp } from "../transporte";

// Mensagem aprovada com hora marcada (ADR-019): o cron a cada 5 minutos só pega as vencidas, e
// as proteções de sempre (horário comercial etc.) continuam valendo.

let contador = 0;
const sp = (iso: string) => new Date(`${iso}-03:00`);

function transporte(atraso = 0) {
  return {
    nome: "teste",
    estado: async () => "conectada",
    enviarTexto: vi.fn(async () => {
      if (atraso) await new Promise((r) => setTimeout(r, atraso));
      return { idExterno: `AG-${randomUUID()}` };
    }),
  } as TransporteWhatsapp & { enviarTexto: ReturnType<typeof vi.fn> };
}

// DDD 89: espaço de números próprio deste arquivo.
async function cenario(agendadaPara: Date | null) {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  const usuario = await prisma.usuario.create({ data: { nome: "Aprovador Agenda", email: `agenda-${sufixo}@teste.local`, perfil: "ADMIN" } });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Agenda ${sufixo}`, situacao: "APROVADA" } });
  const contato = await prisma.contato.create({
    data: { clienteId: empresa.id, nome: "Ana", canal: "WHATSAPP", valor: `(89) 9 96${sufixo.slice(0, 2)}-${sufixo.slice(2)}`, fonte: "Site", origemContato: "PUBLICADO_PELA_EMPRESA" },
  });
  const conversa = await prisma.conversa.create({ data: { linha: "PROSPECCAO", numero: `+5589996${sufixo}`, clienteId: empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() } });
  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId: conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO", status: "APROVADA",
      tipoEnvio: "PRIMEIRO_CONTATO", texto: `Olá, quem cuida da compra? (${sufixo})`, ocorridoEm: new Date(),
      criadaPorId: usuario.id, aprovadaPorId: usuario.id, aprovadaEm: sp("2027-04-05T08:00:00"), agendadaPara,
    },
  });
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
    await prisma.conversa.delete({ where: { id: conversa.id } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.proximoPasso.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { mensagem, limpar };
}
const recarregar = (id: string) => prisma.mensagem.findUniqueOrThrow({ where: { id } });

describe("envio agendado — hora marcada", () => {
  it("antes da hora não sai; depois da hora, o cron envia", async () => {
    const c = await cenario(sp("2027-04-07T10:00:00")); // quarta 10h
    try {
      const t = transporte();
      const antes = await enviarAprovadas({ agora: sp("2027-04-07T09:55:00"), transporte: t, mensagemIds: [c.mensagem.id] });
      expect(antes).toMatchObject({ enviadas: 0, aguardando: 0 });
      expect(t.enviarTexto).not.toHaveBeenCalled();
      expect((await recarregar(c.mensagem.id)).status).toBe("APROVADA");

      const depois = await enviarAprovadas({ agora: sp("2027-04-07T10:00:00"), transporte: t, mensagemIds: [c.mensagem.id] });
      expect(depois.enviadas).toBe(1);
      expect((await recarregar(c.mensagem.id)).status).toBe("ENVIADA");
    } finally {
      await c.limpar();
    }
  });

  it("despachar à mão antes da hora também não envia: diz para quando está agendada", async () => {
    const c = await cenario(sp("2027-04-07T10:00:00"));
    try {
      const t = transporte();
      const r = await despachar(c.mensagem.id, { transporte: t, agora: sp("2027-04-07T09:00:00") });
      expect(r).toMatchObject({ status: "APROVADA", codigos: ["agendada"], motivo: "Agendada para quarta, 07/04/2027 às 10:00." });
      expect(t.enviarTexto).not.toHaveBeenCalled();
    } finally {
      await c.limpar();
    }
  });

  it("agendada para fora do horário comercial espera a próxima abertura", async () => {
    const c = await cenario(sp("2027-04-10T10:00:00")); // sábado
    try {
      const t = transporte();
      const sabado = await enviarAprovadas({ agora: sp("2027-04-10T10:05:00"), transporte: t, mensagemIds: [c.mensagem.id] });
      expect(sabado).toMatchObject({ enviadas: 0, aguardando: 1 });
      expect((await recarregar(c.mensagem.id)).motivoBloqueio).toContain("Fora do horário comercial");
      const segunda = await enviarAprovadas({ agora: sp("2027-04-12T08:00:00"), transporte: t, mensagemIds: [c.mensagem.id] });
      expect(segunda.enviadas).toBe(1);
      expect(t.enviarTexto).toHaveBeenCalledTimes(1);
    } finally {
      await c.limpar();
    }
  });

  it("dois disparos do cron ao mesmo tempo enviam a mensagem uma vez só", async () => {
    const c = await cenario(sp("2027-04-07T10:00:00"));
    try {
      const t = transporte(100);
      const agora = sp("2027-04-07T10:05:00");
      const [a, b] = await Promise.all([
        enviarAprovadas({ agora, transporte: t, mensagemIds: [c.mensagem.id] }),
        enviarAprovadas({ agora, transporte: t, mensagemIds: [c.mensagem.id] }),
      ]);
      expect(t.enviarTexto).toHaveBeenCalledTimes(1);
      expect(a.enviadas + b.enviadas).toBe(1);
      expect((await recarregar(c.mensagem.id)).status).toBe("ENVIADA");
    } finally {
      await c.limpar();
    }
  });

  it("a idade máxima (7 dias) conta da hora marcada, não da aprovação", async () => {
    const c = await cenario(sp("2027-04-20T10:00:00")); // aprovada em 05/04, agendada para 20/04
    try {
      const r = await enviarAprovadas({ agora: sp("2027-04-20T10:00:00"), transporte: transporte(), mensagemIds: [c.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 1, canceladas: 0 });
    } finally {
      await c.limpar();
    }
  });
});
