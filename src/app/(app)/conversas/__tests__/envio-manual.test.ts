import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { despachar } from "@/lib/whatsapp/despachar";
import { enviarAprovadas } from "@/lib/whatsapp/enviar-aprovadas";
import type { TransporteWhatsapp } from "@/lib/whatsapp/transporte";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { marcarComoEnviada } from "../actions";

afterEach(() => obterUsuarioLogadoMock.mockReset());

let contador = 0;
const TEXTO = "Olá, tudo bem? Quem cuida da compra dessa linha aí?";

function transporte() {
  return {
    nome: "teste",
    estado: async () => "conectada",
    enviarTexto: vi.fn(async () => ({ idExterno: "WA-NAO-DEVIA" })),
  } as TransporteWhatsapp & { enviarTexto: ReturnType<typeof vi.fn> };
}

// DDD 94: espaço de números próprio deste arquivo (os outros usam 95 a 99).
async function cenario(opcoes: { situacao?: "APROVADA" | "DESCARTADA"; origem?: boolean; status?: "APROVADA" | "RASCUNHO" | "CANCELADA" | "ENVIADA" } = {}) {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  const usuario = await prisma.usuario.create({ data: { nome: "Rômulo Manual", email: `manual-${sufixo}@teste.local`, perfil: "ANALISTA" } });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Manual ${sufixo}`, situacao: opcoes.situacao ?? "APROVADA" } });
  const contato = await prisma.contato.create({
    data: {
      clienteId: empresa.id, nome: "Ana", canal: "WHATSAPP", valor: `(94) 9 94${sufixo.slice(0, 2)}-${sufixo.slice(2)}`, fonte: "Site",
      origemContato: opcoes.origem === false ? null : "PUBLICADO_PELA_EMPRESA",
    },
  });
  const conversa = await prisma.conversa.create({
    data: { linha: "PROSPECCAO", numero: `+5594994${sufixo}`, clienteId: empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() },
  });
  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId: conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO", status: opcoes.status ?? "APROVADA",
      tipoEnvio: "PRIMEIRO_CONTATO", texto: TEXTO, ocorridoEm: new Date(Date.now() - 3_600_000), criadaPorId: usuario.id, aprovadaPorId: usuario.id,
      aprovadaEm: new Date(Date.now() - 3_600_000),
    },
  });
  const logar = (perfil: "ANALISTA" | "OPERADOR" = "ANALISTA") =>
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil, fabricasIds: [] });
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
    await prisma.conversa.delete({ where: { id: conversa.id } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.proximoPasso.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { usuario, empresa, contato, conversa, mensagem, logar, limpar };
}
const recarregar = (id: string) => prisma.mensagem.findUniqueOrThrow({ where: { id } });
const SO_APROVADA = "Só dá para marcar como enviada uma mensagem aprovada que ainda não saiu.";

describe("marcarComoEnviada — 'Já enviei' depois de enviar pelo celular", () => {
  it("exige sessão e a mesma permissão de aprovar (OPERADOR não)", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect((await marcarComoEnviada({ id: c.mensagem.id })).erros).toEqual(["Sessão expirada. Faça login novamente."]);
      c.logar("OPERADOR");
      expect((await marcarComoEnviada({ id: c.mensagem.id })).erros).toEqual(["Você não tem permissão para acessar o CRM."]);
      expect((await recarregar(c.mensagem.id)).status).toBe("APROVADA");
    } finally {
      await c.limpar();
    }
  });

  it("marca como enviada à mão, por quem, e aplica no CRM o mesmo que o envio automático", async () => {
    const c = await cenario();
    try {
      c.logar();
      const antes = Date.now();
      expect(await marcarComoEnviada({ id: c.mensagem.id })).toEqual({ erros: [] });

      const m = await recarregar(c.mensagem.id);
      expect(m).toMatchObject({ status: "ENVIADA", envioManual: true, enviadaPorId: c.usuario.id, idExterno: null, motivoBloqueio: null });
      expect(m.enviadaEm!.getTime()).toBeGreaterThanOrEqual(antes);
      expect(m.ocorridoEm.getTime()).toBe(m.enviadaEm!.getTime());

      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("EM_CONTATO");
      const passos = await prisma.proximoPasso.findMany({ where: { clienteId: c.empresa.id, concluidoEm: null } });
      expect(passos).toHaveLength(1);
      expect(passos[0]).toMatchObject({ acao: "Acompanhar resposta de Ana", responsavelId: c.usuario.id });
      const interacoes = await prisma.interacao.findMany({ where: { clienteId: c.empresa.id } });
      expect(interacoes).toHaveLength(1);
      expect(interacoes[0]).toMatchObject({ canal: "WHATSAPP", comQuem: "Ana", origem: "USUARIO", usuarioId: c.usuario.id });
      expect(interacoes[0].resumo).toContain("Aprovada → Em contato");
      expect(interacoes[0].resumo).toContain("WhatsApp do celular de prospecção");
    } finally {
      await c.limpar();
    }
  });

  it("é idempotente: tocar duas vezes (ou ao mesmo tempo) não repete os efeitos", async () => {
    const c = await cenario();
    try {
      c.logar();
      const [a, b] = await Promise.all([marcarComoEnviada({ id: c.mensagem.id }), marcarComoEnviada({ id: c.mensagem.id })]);
      expect(a.erros).toEqual([]);
      expect(b.erros).toEqual([]);
      expect(await marcarComoEnviada({ id: c.mensagem.id })).toEqual({ erros: [] });
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(1);
      expect(await prisma.proximoPasso.count({ where: { clienteId: c.empresa.id } })).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("só vale para aprovada esperando: rascunho, cancelada e já enviada pelo automático são recusadas", async () => {
    const rascunho = await cenario({ status: "RASCUNHO" });
    const cancelada = await cenario({ status: "CANCELADA" });
    const automatica = await cenario({ status: "ENVIADA" });
    try {
      for (const c of [rascunho, cancelada, automatica]) {
        c.logar();
        expect((await marcarComoEnviada({ id: c.mensagem.id })).erros).toEqual([SO_APROVADA]);
        expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(0);
      }
      expect((await recarregar(automatica.mensagem.id)).envioManual).toBe(false);
      rascunho.logar();
      expect((await marcarComoEnviada({ id: "nao-existe" })).erros).toEqual([SO_APROVADA]);
    } finally {
      await rascunho.limpar();
      await cancelada.limpar();
      await automatica.limpar();
    }
  });

  it("proteções recusam com o motivo em palavras simples e não mexem em nada", async () => {
    const naoContatar = await cenario();
    const descartada = await cenario({ situacao: "DESCARTADA" });
    const semOrigem = await cenario({ origem: false });
    try {
      await prisma.contato.update({ where: { id: naoContatar.contato.id }, data: { naoContatar: true } });
      const casos = [
        [naoContatar, "não ser contatado"],
        [descartada, "A empresa foi descartada."],
        [semOrigem, "Falta registrar de onde veio o número"],
      ] as const;
      for (const [c, motivo] of casos) {
        c.logar();
        const r = await marcarComoEnviada({ id: c.mensagem.id });
        expect(r.erros).toHaveLength(1);
        expect(r.erros[0]).toContain("Não dá para marcar como enviada");
        expect(r.erros[0]).toContain(motivo);
        expect(await recarregar(c.mensagem.id)).toMatchObject({ status: "APROVADA", envioManual: false, enviadaEm: null });
        expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(0);
        expect(await prisma.proximoPasso.count({ where: { clienteId: c.empresa.id } })).toBe(0);
      }
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: descartada.empresa.id } })).situacao).toBe("DESCARTADA");
    } finally {
      await naoContatar.limpar();
      await descartada.limpar();
      await semOrigem.limpar();
    }
  });

  it("o envio automático nunca reenvia o que foi marcado como enviado à mão", async () => {
    const c = await cenario();
    try {
      c.logar();
      await marcarComoEnviada({ id: c.mensagem.id });
      const t = transporte();
      const resumo = await enviarAprovadas({ transporte: t, mensagemIds: [c.mensagem.id] });
      expect(resumo).toMatchObject({ enviadas: 0, aguardando: 0, canceladas: 0 });
      expect((await despachar(c.mensagem.id, { transporte: t })).status).toBe("IGNORADA");
      expect(t.enviarTexto).not.toHaveBeenCalled();
      expect(await recarregar(c.mensagem.id)).toMatchObject({ status: "ENVIADA", envioManual: true });
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(1);
    } finally {
      await c.limpar();
    }
  });
});
