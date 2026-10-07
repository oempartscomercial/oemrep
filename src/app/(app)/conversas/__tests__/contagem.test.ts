import { describe, it, expect, beforeEach } from "vitest";
import type { SituacaoEmpresa, StatusMensagem, DirecaoMensagem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { contarPendenciasDeConversas } from "../queries";

// DDD 93: espaço de números próprio deste arquivo (os outros usam 94, 96 e 97).
// Os valores são globais no banco de teste, então cada caso compara a diferença.
const base = String(Date.now()).slice(-6);
let contadorNumeros = 0;
function numeroUnico() {
  contadorNumeros += 1;
  const local = `${String(contadorNumeros).padStart(2, "0")}${base}`; // 8 dígitos; com o 9 do celular, 9 no total
  return `+55939${local}`;
}

let contadorEmpresas = 0;
// A contagem olha só as empresas criadas pelo teste em andamento: o banco é dividido com outros
// arquivos de teste, e a contagem geral de rascunhos e conversas muda por conta deles.
let minhasEmpresas: string[] = [];
beforeEach(() => {
  minhasEmpresas = [];
});
const contar = () => contarPendenciasDeConversas({ clienteIds: minhasEmpresas });

async function cenario(situacao: SituacaoEmpresa = "APROVADA") {
  contadorEmpresas += 1;
  const sufixo = `${base}${contadorEmpresas}`;
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Contagem ${sufixo}`, situacao } });
  minhasEmpresas.push(empresa.id);
  const numeros: string[] = [];
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversa: { OR: [{ clienteId: empresa.id }, { numero: { in: numeros } }] } } });
    await prisma.conversa.deleteMany({ where: { OR: [{ clienteId: empresa.id }, { numero: { in: numeros } }] } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
  };
  return { empresa, numeros, limpar };
}
type Cenario = Awaited<ReturnType<typeof cenario>>;

type Semente = { direcao: DirecaoMensagem; status: StatusMensagem; minutos: number };

/** Conversa da empresa com as mensagens dadas; `minutos` diz quão atrás no tempo cada uma ocorreu. */
async function conversaCom(c: Cenario, mensagens: Semente[], clienteId: string | null = c.empresa.id) {
  const numero = numeroUnico();
  c.numeros.push(numero);
  const agora = Date.now();
  const conversa = await prisma.conversa.create({
    data: { linha: "PROSPECCAO", numero, clienteId, ultimaMensagemEm: new Date(agora) },
  });
  for (const m of mensagens) {
    await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        linha: "PROSPECCAO",
        direcao: m.direcao,
        origem: m.direcao === "ENTRADA" ? "CONTATO" : "PLATAFORMA",
        tipo: "TEXTO",
        texto: "Olá, tudo bem?",
        ocorridoEm: new Date(agora - m.minutos * 60_000),
        status: m.status,
        tipoEnvio: m.status === "RASCUNHO" ? "PRIMEIRO_CONTATO" : null,
      },
    });
  }
  return conversa;
}

describe("contarPendenciasDeConversas", () => {
  it("rascunho conta como para aprovar, e não como aguardando resposta", async () => {
    const c = await cenario();
    try {
      const antes = await contar();
      await conversaCom(c, [{ direcao: "SAIDA", status: "RASCUNHO", minutos: 1 }]);
      const depois = await contar();
      expect(depois.paraAprovar - antes.paraAprovar).toBe(1);
      expect(depois.aguardandoResposta - antes.aguardandoResposta).toBe(0);
      expect(depois.total - antes.total).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("conversa cuja última mensagem é do contato conta como aguardando resposta", async () => {
    const c = await cenario();
    try {
      const antes = await contar();
      await conversaCom(c, [{ direcao: "ENTRADA", status: "RECEBIDA", minutos: 5 }]);
      const depois = await contar();
      expect(depois.aguardandoResposta - antes.aguardandoResposta).toBe(1);
      expect(depois.paraAprovar - antes.paraAprovar).toBe(0);
      expect(depois.total - antes.total).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("mensagem já respondida (última é nossa) não conta como aguardando resposta", async () => {
    const c = await cenario();
    try {
      const antes = await contar();
      await conversaCom(c, [
        { direcao: "ENTRADA", status: "RECEBIDA", minutos: 10 },
        { direcao: "SAIDA", status: "ENVIADA", minutos: 5 },
      ]);
      const depois = await contar();
      expect(depois.aguardandoResposta - antes.aguardandoResposta).toBe(0);
      expect(depois.total - antes.total).toBe(0);
    } finally {
      await c.limpar();
    }
  });

  it("rascunho novo depois da nossa resposta conta só para aprovar", async () => {
    const c = await cenario();
    try {
      const antes = await contar();
      await conversaCom(c, [
        { direcao: "ENTRADA", status: "RECEBIDA", minutos: 10 },
        { direcao: "SAIDA", status: "ENVIADA", minutos: 5 },
        { direcao: "SAIDA", status: "RASCUNHO", minutos: 1 },
      ]);
      const depois = await contar();
      expect(depois.paraAprovar - antes.paraAprovar).toBe(1);
      expect(depois.aguardandoResposta - antes.aguardandoResposta).toBe(0);
    } finally {
      await c.limpar();
    }
  });

  it("falha de envio não conta como resposta: o contato ainda espera", async () => {
    const c = await cenario();
    try {
      const antes = await contar();
      await conversaCom(c, [
        { direcao: "ENTRADA", status: "RECEBIDA", minutos: 10 },
        { direcao: "SAIDA", status: "FALHOU", minutos: 5 },
      ]);
      const depois = await contar();
      expect(depois.aguardandoResposta - antes.aguardandoResposta).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("empresa descartada, pausada ou cliente não entra na contagem", async () => {
    const descartada = await cenario("DESCARTADA");
    const pausada = await cenario("PAUSADA");
    const cliente = await cenario("CLIENTE");
    try {
      const antes = await contar();
      for (const c of [descartada, pausada, cliente]) {
        await conversaCom(c, [{ direcao: "ENTRADA", status: "RECEBIDA", minutos: 5 }]);
        await conversaCom(c, [{ direcao: "SAIDA", status: "RASCUNHO", minutos: 1 }]);
      }
      const depois = await contar();
      expect(depois.aguardandoResposta - antes.aguardandoResposta).toBe(0);
      expect(depois.paraAprovar - antes.paraAprovar).toBe(0);
    } finally {
      await descartada.limpar();
      await pausada.limpar();
      await cliente.limpar();
    }
  });

  it("conversa sem empresa vinculada não entra em aguardando resposta", async () => {
    const c = await cenario();
    try {
      const antes = await contar();
      await conversaCom(c, [{ direcao: "ENTRADA", status: "RECEBIDA", minutos: 5 }], null);
      const depois = await contar();
      expect(depois.aguardandoResposta - antes.aguardandoResposta).toBe(0);
    } finally {
      await c.limpar();
    }
  });
});
