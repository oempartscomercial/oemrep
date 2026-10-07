import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/whatsapp/despachar", () => ({
  despachar: async () => ({ status: "ENVIADA" }),
  lerLimites: async () => ({}),
}));

import { criarContato, editarContato } from "../actions";

afterEach(() => {
  obterUsuarioLogadoMock.mockReset();
});

const MENSAGEM_CONVERSA = "Este número já tem conversa. Cadastre um contato novo em vez de trocar o número.";
const MENSAGEM_OUTRA_EMPRESA = "Este número já está ligado a outra empresa.";
const MENSAGEM_DUPLICADO = "Esta empresa já tem esse contato cadastrado.";

// DDD 97: espaço de números próprio deste arquivo (o de actions.test.ts usa o 96).
const base = String(Date.now()).slice(-6);
let contadorNumeros = 0;
function numeroUnico() {
  contadorNumeros += 1;
  const local = `${String(contadorNumeros).padStart(2, "0")}${base}`; // 8 dígitos; com o 9 do celular, 9 no total
  return {
    digitado: `+55 97 9${local.slice(0, 4)} ${local.slice(4)}`,
    formatado: `(97) 9${local.slice(0, 4)}-${local.slice(4)}`,
    e164: `+55979${local}`,
  };
}

let contadorEmpresas = 0;
async function cenario() {
  contadorEmpresas += 1;
  const sufixo = `${base}${contadorEmpresas}`;
  const usuario = await prisma.usuario.create({ data: { nome: "Analista Contato", email: `contato-${sufixo}@teste.local`, perfil: "ANALISTA" } });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Contato ${sufixo}`, situacao: "APROVADA" } });
  const numeros: string[] = [];
  const logar = (perfil: "ANALISTA" | "OPERADOR" = "ANALISTA") =>
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil, fabricasIds: [] });
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversa: { OR: [{ clienteId: empresa.id }, { numero: { in: numeros } }] } } });
    await prisma.conversa.deleteMany({ where: { OR: [{ clienteId: empresa.id }, { numero: { in: numeros } }] } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { usuario, empresa, numeros, logar, limpar };
}

describe("criarContato — permissão", () => {
  it("exige sessão e recusa OPERADOR", async () => {
    const c = await cenario();
    try {
      const n = numeroUnico();
      const entrada = { clienteId: c.empresa.id, canal: "WHATSAPP", valor: n.digitado, fonte: "Site" };
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect((await criarContato(entrada)).erros).toEqual(["Sessão expirada. Faça login novamente."]);
      c.logar("OPERADOR");
      expect((await criarContato(entrada)).erros).toEqual(["Você não tem permissão para acessar o CRM."]);
      expect(await prisma.contato.count({ where: { clienteId: c.empresa.id } })).toBe(0);
    } finally {
      await c.limpar();
    }
  });
});

describe("criarContato", () => {
  it("cadastra com o número no formato legível, guarda a fonte e grava auditoria", async () => {
    const c = await cenario();
    try {
      c.logar();
      const n = numeroUnico();
      const r = await criarContato({
        clienteId: c.empresa.id,
        nome: "  Ana ",
        funcao: "Compras",
        canal: "WHATSAPP",
        valor: n.digitado,
        fonte: "Publicado no site",
        observacoes: "  ",
      });
      expect(r.erros).toEqual([]);
      const contato = await prisma.contato.findUniqueOrThrow({ where: { id: r.id! } });
      expect(contato).toMatchObject({
        clienteId: c.empresa.id,
        nome: "Ana",
        funcao: "Compras",
        canal: "WHATSAPP",
        valor: n.formatado,
        fonte: "Publicado no site",
        observacoes: null,
        naoContatar: false,
        origemContato: null,
      });
      const eventos = await prisma.eventoAuditoria.findMany({ where: { entidade: "Contato", entidadeId: r.id! } });
      expect(eventos.map((e) => e.campo).sort()).toEqual(["canal", "fonte", "funcao", "nome", "valor"]);
      expect(eventos.every((e) => e.usuarioId === c.usuario.id && e.valorAnterior === null)).toBe(true);
    } finally {
      await c.limpar();
    }
  });

  it("recusa telefone sem DDD e não grava nada", async () => {
    const c = await cenario();
    try {
      c.logar();
      const r = await criarContato({ clienteId: c.empresa.id, canal: "WHATSAPP", valor: "99999-8888", fonte: "Site" });
      expect(r.erros).toEqual(["Telefone inválido. Use DDD + número."]);
      expect(await prisma.contato.count({ where: { clienteId: c.empresa.id } })).toBe(0);
    } finally {
      await c.limpar();
    }
  });

  it("recusa fonte vazia", async () => {
    const c = await cenario();
    try {
      c.logar();
      const r = await criarContato({ clienteId: c.empresa.id, canal: "EMAIL", valor: "ana@empresa.com.br", fonte: " " });
      expect(r.erros).toEqual(["Diga de onde veio esse contato (ex.: Indicação do João)."]);
    } finally {
      await c.limpar();
    }
  });

  it("não cadastra o mesmo número de novo, mesmo escrito de outro jeito", async () => {
    const c = await cenario();
    try {
      c.logar();
      const n = numeroUnico();
      expect((await criarContato({ clienteId: c.empresa.id, canal: "WHATSAPP", valor: n.formatado, fonte: "Site" })).erros).toEqual([]);
      expect((await criarContato({ clienteId: c.empresa.id, canal: "WHATSAPP", valor: n.e164, fonte: "Outra fonte" })).erros).toEqual([MENSAGEM_DUPLICADO]);
      expect(await prisma.contato.count({ where: { clienteId: c.empresa.id } })).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("número que já está numa conversa de outra empresa não entra", async () => {
    const a = await cenario();
    const b = await cenario();
    try {
      const n = numeroUnico();
      a.numeros.push(n.e164);
      await prisma.conversa.create({ data: { linha: "PROSPECCAO", numero: n.e164, clienteId: b.empresa.id, ultimaMensagemEm: new Date() } });
      a.logar();
      expect((await criarContato({ clienteId: a.empresa.id, canal: "WHATSAPP", valor: n.digitado, fonte: "Site" })).erros).toEqual([MENSAGEM_OUTRA_EMPRESA]);
      expect(await prisma.contato.count({ where: { clienteId: a.empresa.id } })).toBe(0);
    } finally {
      await a.limpar();
      await b.limpar();
    }
  });

  it("conversa sem empresa com esse número passa a ser do contato novo", async () => {
    const c = await cenario();
    try {
      c.logar();
      const n = numeroUnico();
      c.numeros.push(n.e164);
      const solta = await prisma.conversa.create({
        data: { linha: "PROSPECCAO", numero: n.e164, motivoSemVinculo: "Número sem cadastro", ultimaMensagemEm: new Date() },
      });
      const r = await criarContato({ clienteId: c.empresa.id, canal: "WHATSAPP", valor: n.digitado, fonte: "Site" });
      expect(r.erros).toEqual([]);
      expect(await prisma.conversa.findUniqueOrThrow({ where: { id: solta.id } })).toMatchObject({
        clienteId: c.empresa.id,
        contatoId: r.id,
        motivoSemVinculo: null,
      });
    } finally {
      await c.limpar();
    }
  });
});

describe("editarContato", () => {
  it("com conversa: não troca número nem canal, mas troca nome e fonte; 'não contatar' fica como estava", async () => {
    const c = await cenario();
    try {
      c.logar();
      const n = numeroUnico();
      const outro = numeroUnico();
      c.numeros.push(n.e164);
      const contato = await prisma.contato.create({
        data: {
          clienteId: c.empresa.id,
          nome: "Ana",
          canal: "WHATSAPP",
          valor: n.formatado,
          fonte: "Site",
          naoContatar: true,
          origemContato: "PUBLICADO_PELA_EMPRESA",
        },
      });
      await prisma.conversa.create({ data: { linha: "PROSPECCAO", numero: n.e164, clienteId: c.empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() } });

      expect((await editarContato({ contatoId: contato.id, canal: "WHATSAPP", valor: outro.digitado, fonte: "Site" })).erros).toEqual([MENSAGEM_CONVERSA]);
      expect((await editarContato({ contatoId: contato.id, canal: "TELEFONE", valor: n.digitado, fonte: "Site" })).erros).toEqual([MENSAGEM_CONVERSA]);

      const r = await editarContato({ contatoId: contato.id, nome: "Ana Paula", canal: "WHATSAPP", valor: n.digitado, fonte: "Indicação do João", observacoes: "Prefere manhã" });
      expect(r.erros).toEqual([]);
      expect(await prisma.contato.findUniqueOrThrow({ where: { id: contato.id } })).toMatchObject({
        nome: "Ana Paula",
        fonte: "Indicação do João",
        observacoes: "Prefere manhã",
        valor: n.formatado,
        canal: "WHATSAPP",
        naoContatar: true,
        origemContato: "PUBLICADO_PELA_EMPRESA",
      });
    } finally {
      await c.limpar();
    }
  });

  it("sem conversa: troca o número, zera a origem e deixa rastro das duas mudanças", async () => {
    const c = await cenario();
    try {
      c.logar();
      const n = numeroUnico();
      const novo = numeroUnico();
      const contato = await prisma.contato.create({
        data: { clienteId: c.empresa.id, canal: "WHATSAPP", valor: n.formatado, fonte: "Lista", origemContato: "INDICACAO" },
      });

      const r = await editarContato({ contatoId: contato.id, canal: "WHATSAPP", valor: novo.digitado, fonte: "Lista" });
      expect(r.erros).toEqual([]);
      expect(await prisma.contato.findUniqueOrThrow({ where: { id: contato.id } })).toMatchObject({ valor: novo.formatado, origemContato: null });

      const eventos = await prisma.eventoAuditoria.findMany({ where: { entidade: "Contato", entidadeId: contato.id } });
      expect(eventos).toContainEqual(expect.objectContaining({ campo: "valor", valorAnterior: n.formatado, valorNovo: novo.formatado, usuarioId: c.usuario.id }));
      expect(eventos).toContainEqual(expect.objectContaining({ campo: "origemContato", valorAnterior: "INDICACAO", valorNovo: null }));
    } finally {
      await c.limpar();
    }
  });

  it("não deixa o contato virar duplicata de outro da mesma empresa", async () => {
    const c = await cenario();
    try {
      c.logar();
      const a = numeroUnico();
      const b = numeroUnico();
      await prisma.contato.create({ data: { clienteId: c.empresa.id, canal: "WHATSAPP", valor: a.formatado, fonte: "Site" } });
      const outro = await prisma.contato.create({ data: { clienteId: c.empresa.id, canal: "WHATSAPP", valor: b.formatado, fonte: "Site" } });
      const r = await editarContato({ contatoId: outro.id, canal: "WHATSAPP", valor: a.e164, fonte: "Site" });
      expect(r.erros).toEqual([MENSAGEM_DUPLICADO]);
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: outro.id } })).valor).toBe(b.formatado);
    } finally {
      await c.limpar();
    }
  });

  it("recusa edição sem fonte e não altera o contato", async () => {
    const c = await cenario();
    try {
      c.logar();
      const contato = await prisma.contato.create({ data: { clienteId: c.empresa.id, canal: "EMAIL", valor: "ana@empresa.com.br", fonte: "Site" } });
      const r = await editarContato({ contatoId: contato.id, canal: "EMAIL", valor: "ana@empresa.com.br", fonte: "", nome: "Outra" });
      expect(r.erros).toEqual(["Diga de onde veio esse contato (ex.: Indicação do João)."]);
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: contato.id } })).nome).toBeNull();
    } finally {
      await c.limpar();
    }
  });

  it("exige sessão e recusa OPERADOR", async () => {
    const c = await cenario();
    try {
      const contato = await prisma.contato.create({ data: { clienteId: c.empresa.id, canal: "EMAIL", valor: "ana@empresa.com.br", fonte: "Site" } });
      c.logar("OPERADOR");
      expect((await editarContato({ contatoId: contato.id, canal: "EMAIL", valor: "ana@empresa.com.br", fonte: "Site", nome: "X" })).erros).toEqual([
        "Você não tem permissão para acessar o CRM.",
      ]);
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: contato.id } })).nome).toBeNull();
    } finally {
      await c.limpar();
    }
  });
});
