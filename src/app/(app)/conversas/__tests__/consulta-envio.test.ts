import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/whatsapp/despachar", () => ({
  despachar: async () => ({ status: "ENVIADA" }),
  lerLimites: async () => ({}),
}));

import { consultarEnvio } from "../actions";

afterEach(() => {
  obterUsuarioLogadoMock.mockReset();
});

// DDD 93: espaço de números próprio deste arquivo.
const base = String(Date.now()).slice(-6);
const E164 = `+55939${base.slice(0, 4)}${base.slice(2, 6)}`;
const DIGITADO = `(93) 9${E164.slice(6, 10)}-${E164.slice(10)}`;

async function cenario() {
  const usuario = await prisma.usuario.create({
    data: { nome: "Analista Consulta", email: `consulta-envio-${base}@teste.local`, perfil: "ANALISTA" },
  });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Consulta ${base}`, situacao: "APROVADA" } });
  const contato = await prisma.contato.create({
    data: { clienteId: empresa.id, nome: "Ana", canal: "WHATSAPP", valor: DIGITADO, fonte: "Site", origemContato: "PUBLICADO_PELA_EMPRESA" },
  });
  const conversa = await prisma.conversa.create({
    data: { linha: "PROSPECCAO", numero: E164, clienteId: empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() },
  });
  obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil: "ANALISTA", fabricasIds: [] });
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
    await prisma.conversa.delete({ where: { id: conversa.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { contato, conversa, limpar };
}

describe("consultarEnvio — o que o compositor mostra ao abrir", () => {
  it("devolve o rascunho pendente, a última mensagem recebida e o número", async () => {
    const c = await cenario();
    try {
      await prisma.mensagem.create({
        data: { conversaId: c.conversa.id, linha: "PROSPECCAO", direcao: "ENTRADA", origem: "CONTATO", tipo: "TEXTO", texto: "Quem compra é o Carlos.", status: "RECEBIDA", ocorridoEm: new Date(Date.now() - 3_600_000) },
      });
      await prisma.mensagem.create({
        data: { conversaId: c.conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO", texto: "Segue o catálogo.", status: "RASCUNHO", tipoEnvio: "RESPOSTA", ocorridoEm: new Date() },
      });

      const r = await consultarEnvio({ contatoId: c.contato.id });

      expect(r.erros).toEqual([]);
      expect(r.pendente).toEqual({ texto: "Segue o catálogo.", status: "RASCUNHO" });
      expect(r.ultimaRecebida).toBe("Quem compra é o Carlos.");
      expect(r.numero).toBe(E164);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("sem rascunho pendente, não devolve pendente", async () => {
    const c = await cenario();
    try {
      await prisma.mensagem.create({
        data: { conversaId: c.conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO", texto: "Já saiu.", status: "ENVIADA", tipoEnvio: "PRIMEIRO_CONTATO", ocorridoEm: new Date() },
      });

      const r = await consultarEnvio({ contatoId: c.contato.id });

      expect(r.pendente).toBeUndefined();
      expect(r.ultimaRecebida).toBeUndefined();
    } finally {
      await c.limpar();
    }
  }, 15000);
});
