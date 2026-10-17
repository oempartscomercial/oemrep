import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { prisma } from "@/lib/prisma";
import { criarToken } from "@/lib/mcp/tokens";
import { salvarEvolution } from "@/lib/integracoes/config";
import { POST } from "../route";

// Ferramentas de WhatsApp do MCP de ponta a ponta: o cliente oficial do SDK fala com a rota do
// Next em processo, com o banco de teste. O envio usa o transporte simulado (nada sai para a
// Evolution) e o relógio fica numa quarta-feira às 10h, dentro do horário comercial.

const SUFIXO = `mcpwa${Date.now().toString(36)}`;
const sp = (iso: string) => new Date(`${iso}-03:00`);
const QUARTA_10H = sp("2027-05-05T10:00:00");
let token = "";
let usuario: { id: string; nome: string };
const ids: Record<string, string> = {};
let contador = 0;

// DDD 91: espaço de números próprio deste arquivo.
function telefone() {
  contador += 1;
  const s = String(Date.now() + contador).slice(-6);
  return { cadastro: `(91) 9 96${s.slice(0, 2)}-${s.slice(2)}`, e164: `+5591996${s}` };
}

async function empresa(nome: string, contato: { nome: string; origem?: boolean; naoContatar?: boolean } = { nome: "Ana" }) {
  const t = telefone();
  const c = await prisma.cliente.create({ data: { nomeFantasia: `${nome} ${SUFIXO}`, situacao: "APROVADA", cidade: "Belém", uf: "PA" } });
  await prisma.proximoPasso.create({ data: { clienteId: c.id, acao: "Mandar a primeira mensagem", prazo: new Date("2027-05-05T00:00:00Z"), responsavelId: usuario.id } });
  const ct = await prisma.contato.create({
    data: {
      clienteId: c.id, nome: contato.nome, funcao: "Compras", canal: "WHATSAPP", valor: t.cadastro, fonte: "https://site.exemplo/contato",
      origemContato: contato.origem === false ? null : "PUBLICADO_PELA_EMPRESA", naoContatar: contato.naoContatar ?? false,
    },
  });
  return { id: c.id, contatoId: ct.id, ...t };
}

async function conectar() {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3000/api/mcp"), {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => POST(new Request(input as RequestInfo, init))) as typeof fetch,
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: "teste", version: "1.0.0" });
  await client.connect(transport);
  return client;
}
async function chamar(client: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { texto: r.content.map((c) => c.text).join("\n"), erro: !!r.isError };
}
const idDa = (texto: string) => /\[mensagem_id: (\w+)\]/.exec(texto)?.[1] ?? "";
const TEXTO = "Olá, tudo bem? Sou o Rômulo, da OEM Rep. Vi que vocês trabalham com eixos cardan. Quem cuida da compra dessa linha aí?";

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(QUARTA_10H);
  vi.stubEnv("WHATSAPP_TRANSPORTE", "simulado");
  await prisma.integracao.deleteMany({});
  const u = await prisma.usuario.create({ data: { nome: `Rômulo ${SUFIXO}`, email: `romulo-${SUFIXO}@teste.local`, perfil: "ADMIN" } });
  usuario = { id: u.id, nome: u.nome };
  token = (await criarToken({ id: u.id, nome: u.nome, perfil: "ADMIN", fabricasIds: [] }, "Claude WhatsApp")).token!;
}, 30000);

afterEach(() => vi.setSystemTime(QUARTA_10H));

afterAll(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  const clientes = (await prisma.cliente.findMany({ where: { nomeFantasia: { contains: SUFIXO } }, select: { id: true } })).map((c) => c.id);
  const conversas = (await prisma.conversa.findMany({ where: { clienteId: { in: clientes } }, select: { id: true } })).map((c) => c.id);
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversas } } });
  await prisma.conversa.deleteMany({ where: { id: { in: conversas } } });
  await prisma.interacao.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.proximoPasso.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.contato.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clientes } } });
  await prisma.integracao.deleteMany({});
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
  await prisma.tokenApi.deleteMany({ where: { usuarioId: usuario.id } });
  await prisma.usuario.delete({ where: { id: usuario.id } });
}, 30000);

describe("MCP — WhatsApp de prospecção", () => {
  it("lista as ferramentas novas, com aprovar e cancelar marcadas como escrita", async () => {
    const client = await conectar();
    const { tools } = await client.listTools();
    const nomes = tools.map((t) => t.name);
    for (const n of ["preparar_mensagem_whatsapp", "aprovar_mensagem_whatsapp", "cancelar_mensagem_whatsapp", "mensagens_whatsapp", "status_whatsapp"]) expect(nomes).toContain(n);
    expect(tools.find((t) => t.name === "mensagens_whatsapp")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === "aprovar_mensagem_whatsapp")?.annotations?.readOnlyHint).toBe(false);
    expect(tools.find((t) => t.name === "preparar_mensagem_whatsapp")?.description).toContain("OK explícito");
    await client.close();
  }, 15000);

  it("preparar → aprovar agora: o rascunho mostra destinatário e texto; a aprovação envia e fica 'pelo Claude'", async () => {
    const e = await empresa("Trator Norte");
    ids.enviada = e.id;
    const client = await conectar();
    const prep = await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Trator Norte ${SUFIXO}`, texto: TEXTO });
    expect(prep.erro).toBe(false);
    expect(prep.texto).toContain("AINDA NÃO FOI APROVADO NEM ENVIADO");
    expect(prep.texto).toContain(`Para: Ana, Compras · Trator Norte ${SUFIXO} (Belém/PA)`);
    expect(prep.texto).toContain(TEXTO);
    expect(prep.texto).toContain("Nada impede o envio agora.");
    const id = idDa(prep.texto);
    expect(await prisma.mensagem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "RASCUNHO", geradaPorIa: true, criadaPorId: usuario.id, tipoEnvio: "PRIMEIRO_CONTATO" });

    const apr = await chamar(client, "aprovar_mensagem_whatsapp", { mensagem_id: id, enviar_em: "agora" });
    expect(apr.erro).toBe(false);
    expect(apr.texto).toMatch(/^ENVIADA agora para Ana/);
    expect(apr.texto).toContain(`Aprovada por ${usuario.nome}, pelo Claude.`);
    const m = await prisma.mensagem.findUniqueOrThrow({ where: { id } });
    expect(m).toMatchObject({ status: "ENVIADA", aprovadaPorId: usuario.id, aprovadaPeloClaude: true });
    expect(m.idExterno).toMatch(/^SIM-/);
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: e.id } })).situacao).toBe("EM_CONTATO");

    // Aprovar de novo não faz nada.
    expect((await chamar(client, "aprovar_mensagem_whatsapp", { mensagem_id: id })).erro).toBe(true);
    const hoje = await chamar(client, "mensagens_whatsapp", { filtro: "enviadas_hoje" });
    expect(hoje.texto).toContain(`Trator Norte ${SUFIXO}`);
    await client.close();
  }, 20000);

  it("preparar → aprovar agendado → aparece nas agendadas → cancelar", async () => {
    const e = await empresa("Peças do Pará");
    const client = await conectar();
    const id = idDa((await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Peças do Pará ${SUFIXO}`, contato: "Ana", texto: TEXTO })).texto);
    const apr = await chamar(client, "aprovar_mensagem_whatsapp", { mensagem_id: id, enviar_em: "amanhã 9h" });
    expect(apr.erro).toBe(false);
    expect(apr.texto).toContain("AGENDADA");
    expect(apr.texto).toContain("Agendada para quinta, 06/05/2027 às 09:00.");
    const m = await prisma.mensagem.findUniqueOrThrow({ where: { id } });
    expect(m).toMatchObject({ status: "APROVADA", aprovadaPeloClaude: true, idExterno: null });
    expect(m.agendadaPara).toEqual(sp("2027-05-06T09:00:00"));

    const lista = await chamar(client, "mensagens_whatsapp", { filtro: "agendadas" });
    expect(lista.texto).toContain("agendada para quinta, 06/05/2027 às 09:00");
    expect(lista.texto).toContain(`[mensagem_id: ${id}]`);

    const cancel = await chamar(client, "cancelar_mensagem_whatsapp", { mensagem_id: id });
    expect(cancel.erro).toBe(false);
    expect((await prisma.mensagem.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELADA");
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: e.id } })).situacao).toBe("APROVADA");
    await client.close();
  }, 20000);

  it("bloqueios: sem origem do número (aprovar cancela), não contatar e número que não é da empresa", async () => {
    await empresa("Sem Origem", { nome: "Bruno", origem: false });
    await empresa("Não Quer", { nome: "Carla", naoContatar: true });
    const client = await conectar();

    const prep = await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Sem Origem ${SUFIXO}`, texto: TEXTO });
    expect(prep.texto).toContain("Falta registrar de onde veio o número deste contato. (impede");
    const apr = await chamar(client, "aprovar_mensagem_whatsapp", { mensagem_id: idDa(prep.texto) });
    expect(apr.erro).toBe(true);
    expect(apr.texto).toMatch(/^BLOQUEADA e cancelada/);

    const nao = await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Não Quer ${SUFIXO}`, texto: TEXTO });
    expect(nao.erro).toBe(true);
    expect(nao.texto).toContain("pediu para não ser contatado");

    const outroNumero = await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Sem Origem ${SUFIXO}`, numero: "(91) 98888-7777", texto: TEXTO });
    expect(outroNumero.erro).toBe(true);
    expect(outroNumero.texto).toContain("não está cadastrado");

    const comLink = await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Sem Origem ${SUFIXO}`, texto: "Veja www.oem.com.br, quem compra?" });
    expect(comLink.erro).toBe(true);
    expect(comLink.texto).toContain("não leva link");
    await client.close();
  }, 20000);

  it("fora do horário comercial: aprovada fica esperando, com o motivo; e já existir pendente impede outro rascunho", async () => {
    const e = await empresa("Noturna");
    const client = await conectar();
    const id = idDa((await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Noturna ${SUFIXO}`, texto: TEXTO })).texto);
    vi.setSystemTime(sp("2027-05-05T20:00:00"));
    const apr = await chamar(client, "aprovar_mensagem_whatsapp", { mensagem_id: id });
    expect(apr.erro).toBe(false);
    expect(apr.texto).toMatch(/^APROVADA, mas ainda não saiu: Fora do horário comercial/);
    expect((await prisma.mensagem.findUniqueOrThrow({ where: { id } })).status).toBe("APROVADA");

    const de_novo = await chamar(client, "preparar_mensagem_whatsapp", { empresa: `Noturna ${SUFIXO}`, texto: TEXTO });
    expect(de_novo.erro).toBe(true);
    expect(de_novo.texto).toContain(`[mensagem_id: ${id}]`);

    const passado = await chamar(client, "aprovar_mensagem_whatsapp", { mensagem_id: id, enviar_em: "depois do almoço" });
    expect(passado.erro).toBe(true);
    await prisma.mensagem.update({ where: { id }, data: { status: "CANCELADA" } });
    expect(e.id).toBeTruthy();
    await client.close();
  }, 20000);

  it("respostas: quem escreveu e espera retorno aparece em mensagens_whatsapp", async () => {
    const conversa = await prisma.conversa.findFirstOrThrow({ where: { clienteId: ids.enviada } });
    await prisma.mensagem.create({
      data: { conversaId: conversa.id, linha: "PROSPECCAO", direcao: "ENTRADA", origem: "CONTATO", tipo: "TEXTO", texto: "Sou eu quem compra. Manda o catálogo?", ocorridoEm: sp("2027-05-05T10:30:00"), status: "RECEBIDA", idExterno: `IN-${SUFIXO}` },
    });
    vi.setSystemTime(sp("2027-05-05T11:00:00"));
    const client = await conectar();
    const r = await chamar(client, "mensagens_whatsapp", { filtro: "respostas" });
    expect(r.texto).toContain(`Ana (Trator Norte ${SUFIXO} (Belém/PA))`);
    expect(r.texto).toContain("Sou eu quem compra. Manda o catálogo?");
    const tudo = await chamar(client, "mensagens_whatsapp");
    expect(tudo.texto).toContain("RASCUNHOS ESPERANDO APROVAÇÃO");
    expect(tudo.texto).toContain("RESPOSTAS ESPERANDO RETORNO");
    await client.close();
  }, 20000);

  it("status: sem configuração diz que não está configurado; com a Evolution da tela diz conectado e o número, sem expor a chave", async () => {
    const client = await conectar();
    expect((await chamar(client, "status_whatsapp")).texto).toContain("NÃO CONFIGURADO");

    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    await salvarEvolution(usuario, { url: "https://evo.falsa.exemplo", instancia: "prospeccao", apikey: "api-key-super-secreta", envioAutomatico: false });
    const fetchFalso = vi.fn(async (url: string) => {
      if (String(url).endsWith("/instance/fetchInstances")) {
        return new Response(JSON.stringify([{ name: "prospeccao", connectionStatus: "open", ownerJid: "5598991234567@s.whatsapp.net" }]), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchFalso);
    try {
      const r = await chamar(client, "status_whatsapp");
      expect(r.texto).toContain("CONECTADO com o número (98) 99123-4567");
      expect(r.texto).toContain("Envio automático: DESLIGADO");
      expect(r.texto).toContain("webhook NÃO configurado");
      expect(r.texto).not.toContain("api-key-super-secreta");
      expect(String(fetchFalso.mock.calls[0][0])).toBe("https://evo.falsa.exemplo/instance/fetchInstances");
    } finally {
      vi.unstubAllGlobals();
      await prisma.integracao.deleteMany({});
    }
    await client.close();
  }, 20000);
});
