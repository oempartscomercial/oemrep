import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { prisma } from "@/lib/prisma";
import { criarToken, revogarToken } from "@/lib/mcp/tokens";
import { hojeEmSaoPaulo, somarDias, formatarDiaComSemana } from "@/domain/crm/prazo";
import { POST as postHeader, GET as getHeader } from "../route";
import { POST as postCaminho } from "../[token]/route";

// O servidor MCP de ponta a ponta: o cliente oficial do SDK fala com as rotas do Next em
// processo (fetch redirecionado para os handlers), com o banco de teste de verdade.

const SUFIXO = `mcp${Date.now().toString(36)}`;
const ORIGEM = "http://localhost:3000";
const hoje = hojeEmSaoPaulo();
const amanha = somarDias(hoje, 1);

let usuario: { id: string; nome: string };
let colega: { id: string; nome: string };
let fabrica: { id: string };
let rudolph: { id: string };
let token = "";
const empresas: Record<string, string> = {};

function fetchDasRotas(): typeof fetch {
  return async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    const caminho = new URL(req.url).pathname;
    if (caminho === "/api/mcp") return req.method === "POST" ? postHeader(req) : getHeader(req);
    const m = /^\/api\/mcp\/(.+)$/.exec(caminho);
    if (m) return postCaminho(req, { params: Promise.resolve({ token: m[1] }) });
    throw new Error(`rota inesperada ${caminho}`);
  };
}

async function conectar(opcoes: { header?: string; caminho?: string }) {
  const url = new URL(opcoes.caminho ? `/api/mcp/${opcoes.caminho}` : "/api/mcp", ORIGEM);
  const transport = new StreamableHTTPClientTransport(url, {
    fetch: fetchDasRotas(),
    requestInit: opcoes.header ? { headers: { Authorization: opcoes.header } } : undefined,
  });
  const client = new Client({ name: "teste", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

async function chamar(client: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  return { texto: r.content.map((c) => c.text).join("\n"), erro: !!r.isError };
}

const corpoInicializar = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "curl", version: "0" } },
});
const requisicao = (headers: Record<string, string> = {}) =>
  new Request(`${ORIGEM}/api/mcp`, { method: "POST", body: corpoInicializar, headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } });

beforeAll(async () => {
  usuario = await prisma.usuario.create({ data: { nome: `Rômulo ${SUFIXO}`, email: `romulo-${SUFIXO}@teste.local`, perfil: "ADMIN" } });
  colega = await prisma.usuario.create({ data: { nome: `Zélia ${SUFIXO}`, email: `zelia-${SUFIXO}@teste.local`, perfil: "ANALISTA" } });
  fabrica = await prisma.fabrica.create({ data: { nome: `Bowden ${SUFIXO}` } });
  rudolph = await prisma.fabrica.create({ data: { nome: `Rudolph ${SUFIXO}` } });

  const aprovada = await prisma.cliente.create({
    data: { nomeFantasia: `Real Trator ${SUFIXO}`, situacao: "APROVADA", cidade: "Recife", uf: "PE", site: `realtrator-${SUFIXO}.com.br` },
  });
  await prisma.proximoPasso.create({ data: { clienteId: aprovada.id, acao: "Ligar para o comprador", prazo: new Date(`${hoje}T00:00:00Z`), responsavelId: usuario.id } });
  await prisma.contato.create({ data: { clienteId: aprovada.id, nome: "Ana", funcao: "Compras", canal: "WHATSAPP", valor: "(81) 99999-0001", fonte: "https://realtrator.com.br/contato", origemContato: "PUBLICADO_PELA_EMPRESA" } });
  empresas.aprovada = aprovada.id;

  const candidata = await prisma.cliente.create({ data: { nomeFantasia: `Candidata Norte ${SUFIXO}`, situacao: "CANDIDATA", uf: "PA" } });
  empresas.candidata = candidata.id;
  const emContato = await prisma.cliente.create({ data: { nomeFantasia: `Em Contato ${SUFIXO}`, situacao: "EM_CONTATO", uf: "CE" } });
  await prisma.proximoPasso.create({ data: { clienteId: emContato.id, acao: "Cobrar resposta", prazo: new Date(`${amanha}T00:00:00Z`), responsavelId: usuario.id } });
  await prisma.contato.create({ data: { clienteId: emContato.id, canal: "EMAIL", valor: `compras@emcontato-${SUFIXO}.com.br`, fonte: "site" } });
  empresas.emContato = emContato.id;

  const cliente = await prisma.cliente.create({ data: { nomeFantasia: `Cliente Antigo ${SUFIXO}`, situacao: "CLIENTE", uf: "SC" } });
  empresas.cliente = cliente.id;
  const base = 900_000_000 + Math.floor(Math.random() * 1_000_000);
  const datas = ["2026-03-02", "2026-04-01", "2026-05-01"];
  await prisma.pedidoHistorico.createMany({
    data: [
      ...datas.map((d, i) => ({ data: new Date(`${d}T00:00:00Z`), clienteId: cliente.id, fabricaId: fabrica.id, valor: 1000, rotuloPlanilha: "CLIENTE ANTIGO", linhaPlanilha: base + i, dataSoMes: d.endsWith("-01") })),
      { data: new Date("2026-05-01T00:00:00Z"), clienteId: cliente.id, fabricaId: fabrica.id, valor: 1000, rotuloPlanilha: "CLIENTE ANTIGO", linhaPlanilha: base + 9, suspeitaDuplicidade: true },
    ],
  });

  const criado = await criarToken({ id: usuario.id, nome: usuario.nome, perfil: "ADMIN", fabricasIds: [] }, "Claude do teste");
  token = criado.token!;
}, 30000);

afterAll(async () => {
  const usuarios = [usuario.id, colega.id];
  const clientes = (await prisma.cliente.findMany({ where: { nomeFantasia: { contains: SUFIXO } }, select: { id: true } })).map((c) => c.id);
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: { in: usuarios } } });
  await prisma.interacao.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.proximoPasso.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.contato.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.pedidoHistorico.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.clienteFabrica.deleteMany({ where: { clienteId: { in: clientes } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clientes } } });
  await prisma.tokenApi.deleteMany({ where: { usuarioId: { in: usuarios } } });
  await prisma.fabrica.deleteMany({ where: { id: { in: [fabrica.id, rudolph.id] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
}, 30000);

describe("/api/mcp — autenticação", () => {
  it("sem token, token desconhecido ou malformado: 401, sem tocar no CRM", async () => {
    expect((await postHeader(requisicao())).status).toBe(401);
    expect((await postHeader(requisicao({ authorization: `Bearer oem_${"x".repeat(43)}` }))).status).toBe(401);
    expect((await postHeader(requisicao({ authorization: "Basic abc" }))).status).toBe(401);
    const r = await postCaminho(requisicao(), { params: Promise.resolve({ token: "qualquer" }) });
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("token revogado deixa de valer na hora", async () => {
    const outro = await criarToken({ id: usuario.id, nome: usuario.nome, perfil: "ADMIN", fabricasIds: [] }, "Para revogar");
    expect((await postHeader(requisicao({ authorization: `Bearer ${outro.token}` }))).status).toBe(200);
    await revogarToken({ id: usuario.id, nome: usuario.nome, perfil: "ADMIN", fabricasIds: [] }, outro.id!);
    expect((await postHeader(requisicao({ authorization: `Bearer ${outro.token}` }))).status).toBe(401);
  }, 15000);

  it("GET não abre fluxo (servidor sem sessão): 405", async () => {
    expect((await getHeader(new Request(`${ORIGEM}/api/mcp`, { headers: { authorization: `Bearer ${token}` } }))).status).toBe(405);
  });

  it("o cliente MCP conecta pelo cabeçalho e pelo token no caminho, e vê as ferramentas", async () => {
    for (const client of [await conectar({ header: `Bearer ${token}` }), await conectar({ caminho: token })]) {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(
        [
          "adicionar_contato", "agenda", "agendar", "aprovar_mensagem_whatsapp", "buscar_empresas", "cancelar_mensagem_whatsapp", "carteira",
          "concluir_proximo_passo", "conversas_recentes", "mensagens_whatsapp", "nova_empresa", "preparar_mensagem_whatsapp", "registrar_interacao",
          "status_whatsapp", "ver_empresa",
        ].sort(),
      );
      expect(tools.find((t) => t.name === "agenda")?.annotations?.readOnlyHint).toBe(true);
      await client.close();
    }
    const salvo = await prisma.tokenApi.findFirstOrThrow({ where: { usuarioId: usuario.id, nome: "Claude do teste" } });
    expect(salvo.ultimoUsoEm).not.toBeNull();
  }, 30000);
});

describe("/api/mcp — leitura", () => {
  it("agenda mostra o passo de hoje com dia da semana, responsável e id; e quem espera avaliação", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const { texto, erro } = await chamar(client, "agenda");
    expect(erro).toBe(false);
    expect(texto).toContain(`HOJE É ${formatarDiaComSemana(hoje).toUpperCase()}`);
    expect(texto).toMatch(new RegExp(`Real Trator ${SUFIXO} \\(Recife/PE\\): Ligar para o comprador — ${formatarDiaComSemana(hoje)} \\(hoje\\) — responsável: Rômulo ${SUFIXO} \\[passo: c`));
    expect(texto).toContain(`Candidata Norte ${SUFIXO}`);
    await client.close();
  }, 15000);

  it("buscar_empresas acha pelo site e filtra por situação", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const porSite = await chamar(client, "buscar_empresas", { texto: `realtrator-${SUFIXO}` });
    expect(porSite.texto).toContain(`Real Trator ${SUFIXO} (Recife/PE) [Aprovada]`);
    expect(porSite.texto).toContain(`id: ${empresas.aprovada}`);
    const candidatas = await chamar(client, "buscar_empresas", { texto: SUFIXO, situacao: "candidata" });
    expect(candidatas.texto).toContain(`Candidata Norte ${SUFIXO}`);
    expect(candidatas.texto).not.toContain("Real Trator");
    await client.close();
  }, 15000);

  it("ver_empresa traz contatos com fonte e origem; carteira mostra o ritmo e deixa a linha repetida fora", async () => {
    const client = await conectar({ caminho: token });
    const ficha = await chamar(client, "ver_empresa", { empresa: `Real Trator ${SUFIXO}` });
    expect(ficha.texto).toContain("WhatsApp: (81) 99999-0001 — Ana, Compras");
    expect(ficha.texto).toContain("origem: publicado pela empresa");

    const cart = await chamar(client, "carteira", { cliente: empresas.cliente });
    expect(cart.texto).toContain("R$ 3.000,00 em 3 pedido(s)");
    expect(cart.texto).toContain("Pedido recebido não é faturamento.");
    expect(cart.texto).toContain("ATRASADO em relação ao próprio ritmo");
    expect(cart.texto).toContain("data aproximada");

    const ambiguo = await chamar(client, "ver_empresa", { empresa: SUFIXO });
    expect(ambiguo.erro).toBe(true);
    expect(ambiguo.texto).toContain("Mais de uma empresa");
    await client.close();
  }, 15000);

  it("conversas_recentes é só leitura e responde mesmo sem conversa", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const r = await chamar(client, "conversas_recentes", { empresa: empresas.aprovada });
    expect(r).toEqual({ texto: "Nenhuma conversa de WhatsApp com esta empresa.", erro: false });
    await client.close();
  }, 15000);
});

describe("/api/mcp — escrita", () => {
  it("registrar_interacao em empresa em andamento sem próximo passo aberto: recusa e não grava", async () => {
    await prisma.proximoPasso.updateMany({ where: { clienteId: empresas.aprovada }, data: { concluidoEm: new Date() } });
    const client = await conectar({ header: `Bearer ${token}` });
    const r = await chamar(client, "registrar_interacao", { empresa: empresas.aprovada, canal: "telefone", resumo: "Liguei, não atendeu" });
    expect(r.erro).toBe(true);
    expect(r.texto).toContain("Nada foi gravado. Diga qual é o próximo passo.");
    expect(await prisma.interacao.count({ where: { clienteId: empresas.aprovada } })).toBe(0);
    await client.close();
  }, 15000);

  it("registrar_interacao com próximo passo e contato novo: grava em nome do dono do token, marcado CLAUDE, com auditoria do contato", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const r = await chamar(client, "registrar_interacao", {
      empresa: empresas.aprovada,
      canal: "telefone",
      resumo: "Falei com o João do compras, pediu catálogo",
      com_quem: "João (compras)",
      proximo_passo: { acao: "Mandar catálogo", prazo: amanha.split("-").reverse().join("/"), responsavel: "Zélia" },
      contato_novo: { nome: "João", funcao: "Compras", canal: "telefone", valor: "81 3333-4444" },
    });
    expect(r.erro).toBe(false);
    expect(r.texto).toContain(`Próximo passo: Mandar catálogo — ${formatarDiaComSemana(amanha)} — responsável: Zélia ${SUFIXO}`);

    const inter = await prisma.interacao.findFirstOrThrow({ where: { clienteId: empresas.aprovada } });
    expect(inter).toMatchObject({ origem: "CLAUDE", usuarioId: usuario.id, canal: "TELEFONE", comQuem: "João (compras)" });
    const passos = await prisma.proximoPasso.findMany({ where: { clienteId: empresas.aprovada, concluidoEm: null } });
    expect(passos.map((p) => [p.acao, p.responsavelId])).toEqual([["Mandar catálogo", colega.id]]);
    const contato = await prisma.contato.findFirstOrThrow({ where: { clienteId: empresas.aprovada, nome: "João" } });
    expect(contato).toMatchObject({ valor: "(81) 3333-4444", fonte: `Informado por Rômulo ${SUFIXO} ao Claude` });
    expect(await prisma.eventoAuditoria.count({ where: { entidade: "Contato", entidadeId: contato.id, usuarioId: usuario.id } })).toBeGreaterThan(0);
    await client.close();
  }, 15000);

  it("registrar_interacao mudando a situação audita a etapa; data passada vale, futura não", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const futura = await chamar(client, "registrar_interacao", { empresa: empresas.emContato, canal: "email", resumo: "x", data: somarDias(hoje, 3) });
    expect(futura.erro).toBe(true);

    const ontem = somarDias(hoje, -1);
    const r = await chamar(client, "registrar_interacao", {
      empresa: empresas.emContato,
      canal: "whatsapp",
      resumo: "Respondeu pedindo tabela",
      data: ontem,
      situacao: "conversando",
      proximo_passo: { acao: "Enviar tabela", prazo: "amanhã" },
    });
    expect(r.erro).toBe(false);
    expect(r.texto).toContain("Situação agora: Conversando");
    const empresa = await prisma.cliente.findUniqueOrThrow({ where: { id: empresas.emContato } });
    expect(empresa.situacao).toBe("CONVERSANDO");
    const aud = await prisma.eventoAuditoria.findMany({ where: { entidade: "Cliente", entidadeId: empresas.emContato, campo: "situacao" } });
    expect(aud.map((e) => [e.valorAnterior, e.valorNovo, e.usuarioId])).toEqual([["EM_CONTATO", "CONVERSANDO", usuario.id]]);
    const registro = await prisma.interacao.findFirstOrThrow({ where: { clienteId: empresas.emContato, resumo: "Respondeu pedindo tabela" } });
    expect(registro.data.toISOString().slice(0, 10)).toBe(ontem);
    const passo = await prisma.proximoPasso.findFirstOrThrow({ where: { clienteId: empresas.emContato, concluidoEm: null } });
    expect(passo).toMatchObject({ acao: "Enviar tabela", responsavelId: usuario.id });
    await client.close();
  }, 15000);

  it("agendar substitui o passo aberto; concluir_proximo_passo exige o seguinte em empresa em andamento", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const ag = await chamar(client, "agendar", { empresa: empresas.emContato, acao: "Ligar para fechar", prazo: amanha });
    expect(ag.texto).toContain("(Substituiu o passo anterior: Enviar tabela)");
    const aberto = await prisma.proximoPasso.findFirstOrThrow({ where: { clienteId: empresas.emContato, concluidoEm: null } });
    expect(aberto.acao).toBe("Ligar para fechar");

    const semSeguinte = await chamar(client, "concluir_proximo_passo", { passo_id: aberto.id });
    expect(semSeguinte.erro).toBe(true);
    const ok = await chamar(client, "concluir_proximo_passo", { passo_id: aberto.id, proximo_passo: { acao: "Visitar", prazo: amanha } });
    expect(ok.erro).toBe(false);
    expect((await prisma.proximoPasso.findUniqueOrThrow({ where: { id: aberto.id } })).concluidoEm).not.toBeNull();
    await client.close();
  }, 15000);

  it("não contatar vale na hora: empresa descartada e marcada, contatos marcados, passos encerrados, com auditoria", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const r = await chamar(client, "registrar_interacao", { empresa: empresas.emContato, canal: "email", resumo: "Pediu para não mandarem mais nada", nao_contatar: true });
    expect(r.erro).toBe(false);
    const empresa = await prisma.cliente.findUniqueOrThrow({ where: { id: empresas.emContato }, include: { contatos: true, proximosPassos: { where: { concluidoEm: null } } } });
    expect(empresa).toMatchObject({ situacao: "DESCARTADA", naoContatar: true });
    expect(empresa.contatos.every((c) => c.naoContatar)).toBe(true);
    expect(empresa.proximosPassos).toEqual([]);
    const campos = await prisma.eventoAuditoria.findMany({ where: { entidadeId: { in: [empresa.id, ...empresa.contatos.map((c) => c.id)] }, campo: "naoContatar" } });
    expect(campos).toHaveLength(1 + empresa.contatos.length);

    const agendar = await chamar(client, "agendar", { empresa: empresas.emContato, acao: "Ligar", prazo: amanha });
    expect(agendar.erro).toBe(true);
    await client.close();
  }, 15000);

  it("nova_empresa confere duplicidade, avisa fora do Norte/Nordeste e entra a avaliar", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const parecida = await chamar(client, "nova_empresa", { nome: `Real Trator ${SUFIXO} Peças`, uf: "PE" });
    expect(parecida.erro).toBe(true);
    expect(parecida.texto).toContain(`Real Trator ${SUFIXO} (Recife/PE)`);
    expect(parecida.texto).toContain("mesmo_assim");

    const r = await chamar(client, "nova_empresa", { nome: `Tratorpeças Sul ${SUFIXO}`, uf: "rs", cidade: "Passo Fundo", site: "tratorpecassul.com.br" });
    expect(r.erro).toBe(false);
    expect(r.texto).toContain("a avaliar");
    expect(r.texto).toContain("AVISO: Fora do Norte e Nordeste");
    const nova = await prisma.cliente.findFirstOrThrow({ where: { nomeFantasia: `Tratorpeças Sul ${SUFIXO}` } });
    expect(nova).toMatchObject({ situacao: "CANDIDATA", uf: "RS", origem: "Claude" });
    expect(await prisma.eventoAuditoria.count({ where: { entidade: "Cliente", entidadeId: nova.id, usuarioId: usuario.id } })).toBeGreaterThan(0);
    expect(await prisma.interacao.count({ where: { clienteId: nova.id, origem: "CLAUDE" } })).toBe(1);
    await client.close();
  }, 15000);

  it("adicionar_contato valida e recusa duplicado", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const ok = await chamar(client, "adicionar_contato", { empresa: empresas.candidata, canal: "email", valor: `compras@candidata-${SUFIXO}.com.br`, fonte: "https://candidata.com.br" });
    expect(ok.erro).toBe(false);
    const dup = await chamar(client, "adicionar_contato", { empresa: empresas.candidata, canal: "email", valor: `compras@candidata-${SUFIXO}.com.br` });
    expect(dup).toEqual({ texto: "Nada foi gravado. Esta empresa já tem esse contato cadastrado.", erro: true });
    const ruim = await chamar(client, "adicionar_contato", { empresa: empresas.candidata, canal: "whatsapp", valor: "123" });
    expect(ruim.erro).toBe(true);
    await client.close();
  }, 15000);
});

describe("/api/mcp — fábrica da prospecção", () => {
  it("nova_empresa grava a fábrica; ver_empresa mostra 'prospecção para'; buscar_empresas e agenda filtram pela fábrica", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const errada = await chamar(client, "nova_empresa", { nome: `Fábrica Errada ${SUFIXO}`, uf: "PE", fabricas: ["Bosch"] });
    expect(errada.erro).toBe(true);
    expect(errada.texto).toContain('Fábrica "Bosch" não existe.');
    expect(await prisma.cliente.count({ where: { nomeFantasia: `Fábrica Errada ${SUFIXO}` } })).toBe(0);

    const r = await chamar(client, "nova_empresa", { nome: `Agro Rudolph ${SUFIXO}`, uf: "MA", fabricas: [`rudolph ${SUFIXO}`] });
    expect(r.erro).toBe(false);
    expect(r.texto).toContain(`Prospecção para: Rudolph ${SUFIXO}`);
    expect(r.texto).not.toContain("AVISO");

    const ficha = await chamar(client, "ver_empresa", { empresa: `Agro Rudolph ${SUFIXO}` });
    expect(ficha.texto).toContain(`PROSPECÇÃO PARA: Rudolph ${SUFIXO}`);

    const busca = await chamar(client, "buscar_empresas", { texto: SUFIXO, fabrica: `Rudolph ${SUFIXO}` });
    expect(busca.texto).toContain(`Agro Rudolph ${SUFIXO}`);
    expect(busca.texto).not.toContain("Candidata Norte");
    const soFabrica = await chamar(client, "buscar_empresas", { fabrica: `Rudolph ${SUFIXO}` });
    expect(soFabrica.texto).toContain(`Agro Rudolph ${SUFIXO}`);

    const agenda = await chamar(client, "agenda", { fabrica: `Rudolph ${SUFIXO}` });
    expect(agenda.texto).toContain(`FÁBRICA: Rudolph ${SUFIXO}`);
    expect(agenda.texto).toContain(`Agro Rudolph ${SUFIXO}`);
    expect(agenda.texto).not.toContain(`Candidata Norte ${SUFIXO}`);
    expect(agenda.texto).not.toContain(`Real Trator ${SUFIXO}`);
    await client.close();
  }, 20000);

  it("registrar_interacao inclui e tira fábrica da prospecção; recusa em cliente", async () => {
    const client = await conectar({ header: `Bearer ${token}` });
    const r = await chamar(client, "registrar_interacao", {
      empresa: empresas.candidata,
      canal: "outro",
      resumo: "Vai ser prospectada para duas fábricas",
      incluir_fabricas: [`Rudolph ${SUFIXO}`, `Bowden ${SUFIXO}`],
    });
    expect(r.erro).toBe(false);
    expect(r.texto).toContain(`Prospecção para: Bowden ${SUFIXO}, Rudolph ${SUFIXO}`);
    const r2 = await chamar(client, "registrar_interacao", { empresa: empresas.candidata, canal: "outro", resumo: "Bowden fica para depois", tirar_fabricas: [`Bowden ${SUFIXO}`] });
    expect(r2.texto).toContain(`Prospecção para: Rudolph ${SUFIXO}`);
    const vinculos = await prisma.clienteFabrica.findMany({ where: { clienteId: empresas.candidata } });
    expect(vinculos.map((v) => v.fabricaId)).toEqual([rudolph.id]);

    const cliente = await chamar(client, "registrar_interacao", { empresa: empresas.cliente, canal: "outro", resumo: "teste", incluir_fabricas: [`Rudolph ${SUFIXO}`] });
    expect(cliente.erro).toBe(true);
    expect(cliente.texto).toContain("já é cliente");
    expect(await prisma.interacao.count({ where: { clienteId: empresas.cliente, resumo: "teste" } })).toBe(0);
    await client.close();
  }, 20000);
});
