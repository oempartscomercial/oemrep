import { prisma } from "@/lib/prisma";
import { filtroFabricasPermitidas } from "@/lib/authz";
import type { UsuarioSessao } from "@/lib/sessao";
import { montarWhereEmpresas } from "@/lib/crm/busca";
import { buscarFicha } from "@/app/(app)/empresas/queries";
import { buscarSugestoes } from "@/app/(app)/funis/queries";
import { separarAgenda } from "@/domain/crm/agenda";
import { analisarCarteira, COMO_FOI_CALCULADO, type ClienteNaCarteira } from "@/domain/crm/carteira";
import { etapaAtiva } from "@/domain/crm/funil";
import { ROTULO_ETAPA_OP, type EtapaOportunidade } from "@/domain/crm/oportunidade";
import { descreverPrazo, formatarDia, formatarDiaComSemana, hojeEmSaoPaulo, somarDias } from "@/domain/crm/prazo";
import { formatarReais } from "@/domain/formato/moeda";
import { descreverMensagem, diaEmSaoPaulo, formatarNumero } from "@/domain/mensagens/exibicao";
import { localDa, nomeComLocal, resolverEmpresa, rotuloSituacao } from "./resolver";

// Ferramentas de leitura do servidor MCP. Respostas em texto curto e estruturado, em
// português; ids só onde a chamada seguinte precisa deles.

export type Resposta = { texto: string; erro?: boolean };

const falha = (texto: string): Resposta => ({ texto, erro: true });
const dia = (d: Date) => d.toISOString().slice(0, 10);
const AVISO_PEDIDO = "Pedido recebido não é faturamento.";

function bloco(titulo: string, linhas: string[], limite = 15): string {
  const corpo = linhas.length === 0 ? ["- nada"] : [...linhas.slice(0, limite), ...(linhas.length > limite ? [`- … e mais ${linhas.length - limite}`] : [])];
  return [`${titulo} (${linhas.length})`, ...corpo].join("\n");
}

const CANAL_INTERACAO: Record<string, string> = { WHATSAPP: "WhatsApp", TELEFONE: "Ligação", EMAIL: "E-mail", VISITA: "Visita", REUNIAO: "Reunião", PESQUISA: "Pesquisa", OUTRO: "Anotação" };
const CANAL_CONTATO: Record<string, string> = { WHATSAPP: "WhatsApp", TELEFONE: "Telefone", EMAIL: "E-mail", LINKEDIN: "LinkedIn", OUTRO: "Outro" };
const ORIGEM_CONTATO: Record<string, string> = {
  PUBLICADO_PELA_EMPRESA: "publicado pela empresa",
  INDICACAO: "indicação",
  BASE_PROFISSIONAL: "base profissional",
  RELACIONAMENTO: "relacionamento",
};
const ESTADO_PEDIDO: Record<string, string> = { SEM_NFE: "sem nota", PARCIAL: "parcial", COMPLETO: "completo", ARQUIVADO: "arquivado" };

function autorDa(i: { origem: string; usuario: { nome: string } | null }): string {
  if (i.origem === "CLAUDE") return `${i.usuario?.nome ?? "alguém"}, pelo Claude`;
  if (i.origem === "AUTOMACAO") return "automação";
  if (i.origem === "IMPORTACAO") return "importação";
  return i.usuario?.nome ?? "—";
}

// ---------------------------------------------------------------------------- agenda

export async function agenda(): Promise<Resposta> {
  const hoje = hojeEmSaoPaulo();
  const [passos, andamento, candidatas, conversas, rascunhos] = await Promise.all([
    prisma.proximoPasso.findMany({
      where: { concluidoEm: null, cliente: { situacao: { not: "DESCARTADA" } } },
      include: { cliente: true, responsavel: { select: { nome: true } }, oportunidade: { include: { fabrica: true } } },
    }),
    prisma.cliente.findMany({
      where: { situacao: { in: ["APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO"] }, proximosPassos: { none: { concluidoEm: null, oportunidadeId: null } } },
      orderBy: { nomeFantasia: "asc" },
    }),
    prisma.cliente.findMany({ where: { situacao: "CANDIDATA" }, orderBy: { criadoEm: "asc" } }),
    prisma.conversa.findMany({
      where: { linha: "PROSPECCAO", clienteId: { not: null } },
      include: { cliente: { select: { nomeFantasia: true } }, mensagens: { where: { status: { in: ["RECEBIDA", "ENVIADA", "ENTREGUE", "LIDA"] } }, orderBy: { ocorridoEm: "desc" }, take: 1 } },
      orderBy: { ultimaMensagemEm: "desc" },
      take: 100,
    }),
    prisma.mensagem.count({ where: { linha: "PROSPECCAO", direcao: "SAIDA", status: { in: ["RASCUNHO", "APROVADA"] } } }),
  ]);

  const linhas = passos.map((p) => ({ ...p, prazo: dia(p.prazo) }));
  const grupos = separarAgenda(linhas, hoje);
  const linha = (p: (typeof linhas)[number]) =>
    `- ${nomeComLocal(p.cliente)}${p.oportunidade ? ` · carteira ${p.oportunidade.fabrica.nome}` : ""}: ${p.acao} — ${formatarDiaComSemana(p.prazo)} (${descreverPrazo(p.prazo, hoje)}) — responsável: ${p.responsavel.nome} [passo: ${p.id}]`;
  const esperando = conversas.filter((c) => c.mensagens[0]?.direcao === "ENTRADA");

  const partes = [
    `HOJE É ${formatarDiaComSemana(hoje).toUpperCase()}`,
    bloco("ATRASADO", grupos.atrasados.map(linha)),
    bloco("PARA HOJE", grupos.hoje.map(linha)),
    bloco("PRÓXIMOS 7 DIAS", grupos.proximos7.map(linha)),
  ];
  if (grupos.depois.length > 0) partes.push(`MAIS PARA FRENTE: ${grupos.depois.length} tarefa(s) depois de ${formatarDia(somarDias(hoje, 7))}`);
  if (andamento.length > 0) partes.push(bloco("EMPRESAS EM ANDAMENTO SEM PRÓXIMO PASSO", andamento.map((e) => `- ${nomeComLocal(e)} [${rotuloSituacao(e.situacao)}]`)));
  partes.push(bloco("ESPERANDO AVALIAÇÃO (a avaliar)", candidatas.map((e) => `- ${nomeComLocal(e)} · id: ${e.id}`), 5));
  if (esperando.length > 0 || rascunhos > 0) {
    partes.push(
      [
        "WHATSAPP DE PROSPECÇÃO",
        ...esperando.slice(0, 5).map((c) => `- ${c.cliente?.nomeFantasia} respondeu e espera retorno`),
        ...(rascunhos > 0 ? [`- ${rascunhos} mensagem(ns) esperando aprovação na plataforma`] : []),
      ].join("\n"),
    );
  }
  return { texto: partes.join("\n\n") };
}

// ---------------------------------------------------------------------------- busca

const SITUACOES = ["CANDIDATA", "APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO", "PAUSADA", "DESCARTADA", "CLIENTE"] as const;

export async function buscarEmpresas(args: { texto?: string; situacao?: string }): Promise<Resposta> {
  const texto = args.texto?.trim() ?? "";
  const situacao = args.situacao?.trim().toUpperCase();
  if (situacao && !(SITUACOES as readonly string[]).includes(situacao)) return falha(`Situação desconhecida: ${args.situacao}.`);
  if (!texto && !situacao) return falha("Diga o que procurar (nome, CNPJ, site ou cidade) ou uma situação.");

  const where = { ...montarWhereEmpresas("todas", texto), ...(situacao ? { situacao: situacao as (typeof SITUACOES)[number] } : {}) };
  const [total, empresas] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      orderBy: { nomeFantasia: "asc" },
      take: 20,
      include: { proximosPassos: { where: { concluidoEm: null, oportunidadeId: null }, orderBy: { prazo: "asc" }, take: 1 } },
    }),
  ]);
  if (total === 0) return { texto: `Nenhuma empresa encontrada${texto ? ` para "${texto}"` : ""}${situacao ? ` na situação ${rotuloSituacao(situacao)}` : ""}.` };
  const linhas = empresas.map((e) => {
    const passo = e.proximosPassos[0];
    const extra = [e.naoContatar ? "NÃO CONTATAR" : null, passo ? `próximo: ${passo.acao} (${formatarDia(dia(passo.prazo))})` : null].filter(Boolean).join(" — ");
    return `- ${nomeComLocal(e)} [${rotuloSituacao(e.situacao)}]${extra ? ` — ${extra}` : ""} · id: ${e.id}`;
  });
  const mais = total > empresas.length ? `\n- … e mais ${total - empresas.length}. Refine a busca.` : "";
  return { texto: `${total} empresa(s):\n${linhas.join("\n")}${mais}` };
}

// ---------------------------------------------------------------------------- ficha

export async function verEmpresa(usuario: UsuarioSessao, args: { empresa: string }): Promise<Resposta> {
  const r = await resolverEmpresa(args.empresa);
  if (!r.ok) return falha(r.mensagem);
  const ficha = await buscarFicha(r.valor.id, usuario);
  if (!ficha) return falha("Empresa não encontrada.");
  const { empresa, historico } = ficha;
  const hoje = hojeEmSaoPaulo();

  const dados = [localDa(empresa), empresa.cnpj ? `CNPJ ${empresa.cnpj}` : "CNPJ não informado", empresa.site].filter(Boolean).join(" · ");
  const partes: string[] = [
    [
      `FICHA: ${empresa.nomeFantasia} — ${rotuloSituacao(empresa.situacao)}${empresa.naoContatar ? " — NÃO CONTATAR" : ""} · id: ${empresa.id}`,
      `Dados: ${dados}`,
      ...(empresa.grupo ? [`Grupo: ${empresa.grupo}`] : []),
      ...(empresa.observacoes ? [`Observações: ${empresa.observacoes}`] : []),
    ].join("\n"),
  ];

  const passos = empresa.proximosPassos.map((p) => {
    const op = p.oportunidadeId ? empresa.oportunidades.find((o) => o.id === p.oportunidadeId) : null;
    return `- ${op ? `Carteira · ${op.fabrica.nome}: ` : ""}${p.acao} — ${formatarDiaComSemana(dia(p.prazo))} (${descreverPrazo(dia(p.prazo), hoje)}) — responsável: ${p.responsavel.nome} [passo: ${p.id}]`;
  });
  partes.push(passos.length > 0 ? `PRÓXIMOS PASSOS\n${passos.join("\n")}` : `PRÓXIMO PASSO: nenhum${etapaAtiva(empresa.situacao) ? " (empresa em andamento: precisa de um)" : ""}`);

  partes.push(
    bloco(
      "CONTATOS",
      empresa.contatos.map((c) => {
        const quem = [c.nome, c.funcao].filter(Boolean).join(", ");
        return [
          `- ${CANAL_CONTATO[c.canal] ?? c.canal}: ${c.valor}${quem ? ` — ${quem}` : ""}${c.servePara ? ` — serve para: ${c.servePara}` : ""}${c.naoContatar ? " — NÃO CONTATAR" : ""}`,
          `  fonte: ${c.fonte}${c.origemContato ? ` · origem: ${ORIGEM_CONTATO[c.origemContato]}` : " · origem do número não registrada"}`,
        ].join("\n");
      }),
      20,
    ),
  );

  partes.push(
    bloco(
      "INTERAÇÕES (mais recentes primeiro)",
      empresa.interacoes.map((i) => {
        const titulo = `${CANAL_INTERACAO[i.canal] ?? i.canal}${i.comQuem ? ` com ${i.comQuem}` : ""}${i.oportunidade ? ` · ${i.oportunidade.fabrica.nome}` : ""}`;
        return `- ${formatarDia(diaEmSaoPaulo(i.data))} · ${titulo}: ${i.resumo}${i.resultado ? ` → ${i.resultado}` : ""} (${autorDa(i)})`;
      }),
      10,
    ),
  );

  const abertas = empresa.oportunidades.filter((o) => o.etapa !== "GANHA" && o.etapa !== "PERDIDA");
  if (abertas.length > 0) partes.push(`OPORTUNIDADES DA CARTEIRA\n${abertas.map((o) => `- ${o.fabrica.nome}: ${ROTULO_ETAPA_OP[o.etapa as EtapaOportunidade]}`).join("\n")}`);

  if (empresa.fabricas.length > 0) partes.push(`FÁBRICAS QUE COMPRA (cadastro): ${empresa.fabricas.map((f) => f.fabrica.nome).sort().join(", ")}`);

  if (historico.length > 0) {
    const carteira = await carteiraDoCliente(usuario, empresa.id, hoje);
    partes.push(
      [
        `PEDIDOS RECEBIDOS — planilha (${AVISO_PEDIDO} Linhas que parecem repetidas ficam fora.)`,
        ...historico.map((h) => `- ${h.fabrica}: ${formatarReais(h.valor)} em ${h.pedidos} pedido(s), último em ${h.ultimo ? formatarDia(dia(h.ultimo)) : "—"}`),
        ...(carteira ? [resumoCarteira(carteira)] : []),
      ].join("\n"),
    );
  }
  if (empresa.pedidos.length > 0) {
    partes.push(
      bloco(
        "PEDIDOS LANÇADOS NA PLATAFORMA",
        empresa.pedidos.map((p) => `- ${p.semNumero ? "S/N" : p.numero} · ${p.fabrica.nome} · ${formatarDia(diaEmSaoPaulo(p.dataPedido ?? p.criadoEm))} · ${ESTADO_PEDIDO[p.estado] ?? p.estado}`),
        5,
      ),
    );
  }
  if (empresa.conversas.length > 0) {
    const reais = empresa.conversas.flatMap((c) => c.mensagens.filter((m) => m.status !== "RASCUNHO" && m.status !== "CANCELADA" && m.status !== "FALHOU"));
    const ultima = reais.sort((a, b) => b.ocorridoEm.getTime() - a.ocorridoEm.getTime())[0];
    if (ultima) {
      const { aviso, texto } = descreverMensagem(ultima);
      partes.push(`WHATSAPP: ${empresa.conversas.length} conversa(s); última mensagem em ${formatarDia(diaEmSaoPaulo(ultima.ocorridoEm))} (${ultima.direcao === "ENTRADA" ? "recebida" : "enviada"}): ${aviso ?? ""}${aviso && texto ? ": " : ""}${(texto ?? "").slice(0, 200)}`);
    }
  }
  return { texto: partes.join("\n\n") };
}

// ---------------------------------------------------------------------------- carteira

async function comprasDaPlanilha(usuario: UsuarioSessao, clienteId?: string) {
  const fabricas = filtroFabricasPermitidas(usuario);
  return prisma.pedidoHistorico.findMany({
    where: { ...(fabricas ? { fabricaId: { in: fabricas } } : {}), ...(clienteId ? { clienteId } : {}) },
    select: { clienteId: true, data: true, dataSoMes: true, valor: true, tipo: true, suspeitaDuplicidade: true, fabrica: { select: { nome: true } } },
  });
}

const validas = (linhas: Awaited<ReturnType<typeof comprasDaPlanilha>>) =>
  linhas
    .filter((l) => l.tipo === "PEDIDO" && !l.suspeitaDuplicidade)
    .map((l) => ({ clienteId: l.clienteId, data: dia(l.data), valor: Number(l.valor), fabrica: l.fabrica.nome, dataSoMes: l.dataSoMes }));

async function carteiraDoCliente(usuario: UsuarioSessao, clienteId: string, hoje: string): Promise<ClienteNaCarteira | null> {
  return analisarCarteira(validas(await comprasDaPlanilha(usuario, clienteId)), hoje)[0] ?? null;
}

const ESTADO_CARTEIRA = {
  atrasado: "ATRASADO em relação ao próprio ritmo",
  em_dia: "em dia",
  sumiu: "comprou pouco e não voltou há mais de 60 dias",
  recente: "compra recente",
} as const;

function resumoCarteira(c: ClienteNaCarteira): string {
  return `Situação na carteira: ${ESTADO_CARTEIRA[c.estado]} — última compra ${formatarDia(c.ultimaCompra)}${c.ultimaAproximada ? " (data aproximada: pode ser só o mês)" : ""}, há ${c.diasSemComprar} dias${c.ritmoDias ? `; costuma comprar a cada ~${Math.round(c.ritmoDias)} dias` : ""}.`;
}

export async function carteira(usuario: UsuarioSessao, args: { cliente?: string; limite?: number }): Promise<Resposta> {
  const hoje = hojeEmSaoPaulo();
  const limite = Math.min(Math.max(args.limite ?? 10, 1), 50);

  if (args.cliente?.trim()) {
    const r = await resolverEmpresa(args.cliente);
    if (!r.ok) return falha(r.mensagem);
    const item = await carteiraDoCliente(usuario, r.valor.id, hoje);
    if (!item) return { texto: `${nomeComLocal(r.valor)}: nenhum pedido válido na planilha de pedidos recebidos.` };
    return {
      texto: [
        `CLIENTE: ${nomeComLocal(r.valor)} · id: ${r.valor.id}`,
        `Total na planilha: ${formatarReais(item.valor)} em ${item.pedidos} pedido(s) (${item.compras} data(s) de compra). ${AVISO_PEDIDO}`,
        resumoCarteira(item),
        "Por fábrica:",
        ...Object.entries(item.porFabrica)
          .sort((a, b) => b[1] - a[1])
          .map(([f, v]) => `- ${f}: ${formatarReais(v)}`),
      ].join("\n"),
    };
  }

  const linhas = await comprasDaPlanilha(usuario);
  if (linhas.length === 0) return { texto: "A planilha de pedidos recebidos ainda não foi carregada na plataforma." };
  const boas = validas(linhas);
  const analise = analisarCarteira(boas, hoje);
  const clientes = await prisma.cliente.findMany({ where: { id: { in: analise.map((a) => a.clienteId) } }, select: { id: true, nomeFantasia: true, cidade: true, uf: true, grupo: true } });
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const nome = (id: string) => {
    const c = porId.get(id);
    return c ? nomeComLocal(c) : "—";
  };
  const linhaCliente = (i: ClienteNaCarteira) =>
    `- ${nome(i.clienteId)}: última compra ${formatarDia(i.ultimaCompra)}${i.ultimaAproximada ? " (data aproximada)" : ""}, há ${i.diasSemComprar} dias${i.ritmoDias ? ` — costuma comprar a cada ~${Math.round(i.ritmoDias)} dias` : ""} — total ${formatarReais(i.valor)}`;

  const total = boas.reduce((s, b) => s + b.valor, 0);
  const datas = boas.map((b) => b.data).sort();
  const bonificacao = linhas.filter((l) => l.tipo === "BONIFICACAO");
  const repetidas = linhas.filter((l) => l.suspeitaDuplicidade);
  const soma = (ls: typeof linhas) => formatarReais(ls.reduce((s, l) => s + Number(l.valor), 0));

  const partes = [
    [
      `CARTEIRA — pedidos recebidos de ${formatarDia(datas[0])} a ${formatarDia(datas[datas.length - 1])}. ${AVISO_PEDIDO}`,
      `Total: ${formatarReais(total)} em ${boas.length} pedidos de ${analise.length} clientes.`,
      ...(bonificacao.length || repetidas.length
        ? [
            `Fora da conta: ${[
              bonificacao.length ? `${bonificacao.length} bonificação(ões) (${soma(bonificacao)})` : null,
              repetidas.length ? `${repetidas.length} pedido(s) que parecem lançados em dobro (${soma(repetidas)}), até o Rômulo confirmar` : null,
            ]
              .filter(Boolean)
              .join("; ")}.`,
          ]
        : []),
    ].join("\n"),
  ];

  const grupos = new Map<string, number>();
  for (const i of analise) {
    const g = porId.get(i.clienteId)?.grupo;
    if (g) grupos.set(g, (grupos.get(g) ?? 0) + i.valor);
  }
  for (const [g, v] of grupos) {
    if (total > 0) partes.push(`Atenção: os clientes do grupo "${g}" somam ${formatarReais(v)} (${Math.round((v / total) * 100)}% do total).`);
  }

  partes.push(bloco("COMPRAVAM COM FREQUÊNCIA E ESTÃO ATRASADOS", analise.filter((i) => i.estado === "atrasado").map(linhaCliente), limite));
  partes.push(bloco("COMPRARAM 1 OU 2 VEZES E NÃO VOLTARAM HÁ MAIS DE 60 DIAS", analise.filter((i) => i.estado === "sumiu").map(linhaCliente), limite));

  const sugestoes = await buscarSugestoes();
  if (sugestoes.length > 0) {
    partes.push(
      bloco(
        "FÁBRICAS QUE O CLIENTE AINDA NÃO COMPRA (cadastro; ideias para oferecer)",
        sugestoes.map((s) => `- ${s.cliente}: compra ${s.compra.join(", ") || "—"}; ainda não compra ${s.fabrica}`),
        limite,
      ),
    );
  }
  partes.push(`COMO FOI CALCULADO: ${COMO_FOI_CALCULADO}`);
  return { texto: partes.join("\n\n") };
}

// ---------------------------------------------------------------------------- conversas

const REAIS = ["RECEBIDA", "ENVIADA", "ENTREGUE", "LIDA"] as const;

export async function conversasRecentes(args: { empresa?: string; limite?: number }): Promise<Resposta> {
  let clienteId: string | undefined;
  if (args.empresa?.trim()) {
    const r = await resolverEmpresa(args.empresa);
    if (!r.ok) return falha(r.mensagem);
    clienteId = r.valor.id;
  }
  const limite = Math.min(Math.max(args.limite ?? 10, 1), 30);
  const conversas = await prisma.conversa.findMany({
    where: { linha: "PROSPECCAO", ...(clienteId ? { clienteId } : {}) },
    orderBy: { ultimaMensagemEm: "desc" },
    take: limite,
    include: {
      cliente: { select: { nomeFantasia: true } },
      contato: { select: { nome: true } },
      mensagens: { where: { status: { in: [...REAIS] } }, orderBy: { ocorridoEm: "desc" }, take: 3 },
    },
  });
  if (conversas.length === 0) return { texto: clienteId ? "Nenhuma conversa de WhatsApp com esta empresa." : "Nenhuma conversa de WhatsApp registrada." };

  const blocos = conversas.map((c) => {
    const quem = [c.contato?.nome ?? c.nomeNoWhatsapp, c.cliente?.nomeFantasia ?? "sem empresa identificada"].filter(Boolean).join(" · ");
    const esperando = c.mensagens[0]?.direcao === "ENTRADA" ? " — ESPERA SUA RESPOSTA" : "";
    const msgs = [...c.mensagens].reverse().map((m) => {
      const { aviso, texto } = descreverMensagem(m);
      const conteudo = [aviso, texto?.slice(0, 300)].filter(Boolean).join(": ");
      return `  ${formatarDia(diaEmSaoPaulo(m.ocorridoEm))} ${m.direcao === "ENTRADA" ? "←" : "→"} ${conteudo || "(sem texto)"}`;
    });
    return [`- ${quem} ${formatarNumero(c.numero)}${esperando}`, ...msgs].join("\n");
  });
  return { texto: `Conversas da linha de prospecção (mais recentes primeiro; → enviada, ← recebida). Somente leitura: mensagens saem pela plataforma, com aprovação.\n${blocos.join("\n")}` };
}
