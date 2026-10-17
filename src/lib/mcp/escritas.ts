import type { UsuarioSessao } from "@/lib/sessao";
import * as crm from "@/lib/crm/empresas";
import { criarContato } from "@/lib/crm/contatos";
import { criarEmpresaProspeccao } from "@/lib/crm/prospeccao";
import { ajustarFabricasProspeccao } from "@/lib/crm/fabricas-prospeccao";
import { formatarDia, formatarDiaComSemana, hojeEmSaoPaulo, interpretarDia } from "@/domain/crm/prazo";
import { nomeComLocal, resolverEmpresa, resolverFabricas, resolverResponsavel, rotuloSituacao } from "./resolver";
import type { Resposta } from "./consultas";

// Ferramentas de escrita do servidor MCP. Toda gravação sai em nome do dono do token, com
// origem CLAUDE na linha do tempo, e passa pelas mesmas regras das telas (src/lib/crm).

const falha = (texto: string): Resposta => ({ texto, erro: true });
const autor = (u: UsuarioSessao): crm.Autor => ({ id: u.id, nome: u.nome, origem: "CLAUDE" });
const maiusculo = (s: string | null | undefined) => (s?.trim() ? s.trim().toUpperCase() : undefined);

export type PassoArgs = { acao: string; prazo: string; responsavel?: string | null };

async function lerPasso(usuario: UsuarioSessao, passo: PassoArgs, hoje: string): Promise<{ ok: true; passo: crm.PassoEntrada; responsavel: string } | { ok: false; mensagem: string }> {
  const prazo = interpretarDia(passo.prazo, hoje);
  if (!prazo) return { ok: false, mensagem: `Não entendi a data do próximo passo ("${passo.prazo}"). Use DD/MM/AAAA.` };
  const resp = await resolverResponsavel(passo.responsavel, usuario.id);
  if (!resp.ok) return resp;
  return { ok: true, passo: { acao: passo.acao, prazo, responsavelId: resp.valor.id }, responsavel: resp.valor.nome };
}

const linhaPasso = (acao: string, prazo: string, responsavel: string) => `${acao.trim()} — ${formatarDiaComSemana(prazo)} — responsável: ${responsavel}`;

// ---------------------------------------------------------------------------- registrar

export type RegistrarArgs = {
  empresa: string;
  canal: string;
  resumo: string;
  com_quem?: string;
  resultado?: string;
  data?: string;
  situacao?: string;
  motivo?: string;
  retomada_em?: string;
  proximo_passo?: PassoArgs;
  sem_proximo_passo?: boolean;
  nao_contatar?: boolean;
  incluir_fabricas?: string[];
  tirar_fabricas?: string[];
  contato_novo?: {
    nome?: string;
    funcao?: string;
    canal: string;
    valor: string;
    serve_para?: string;
    fonte?: string;
    origem_contato?: string;
  };
};

const CANAL: Record<string, string> = { WHATSAPP: "WhatsApp", TELEFONE: "ligação", EMAIL: "e-mail", VISITA: "visita", REUNIAO: "reunião", OUTRO: "anotação" };

/** Quando aconteceu: hoje = agora; dia passado = meio-dia em São Paulo; futuro não vale. */
function momentoDoContato(texto: string | undefined, hoje: string): { ok: true; data: Date; dia: string } | { ok: false; mensagem: string } {
  if (!texto?.trim()) return { ok: true, data: new Date(), dia: hoje };
  const d = interpretarDia(texto, hoje);
  if (!d) return { ok: false, mensagem: `Não entendi a data do contato ("${texto}"). Use DD/MM/AAAA.` };
  if (d > hoje) return { ok: false, mensagem: "A data do contato não pode estar no futuro. Para marcar algo, use proximo_passo ou agendar." };
  return { ok: true, data: d === hoje ? new Date() : new Date(`${d}T15:00:00Z`), dia: d };
}

const fontePadrao = (u: UsuarioSessao) => `Informado por ${u.nome} ao Claude`;

export async function registrarInteracao(usuario: UsuarioSessao, args: RegistrarArgs): Promise<Resposta> {
  const hoje = hojeEmSaoPaulo();
  const r = await resolverEmpresa(args.empresa);
  if (!r.ok) return falha(r.mensagem);
  const empresa = r.valor;

  const quando = momentoDoContato(args.data, hoje);
  if (!quando.ok) return falha(quando.mensagem);

  // Fábricas da prospecção: conferidas antes de gravar qualquer coisa.
  const incluir = await resolverFabricas(args.incluir_fabricas);
  if (!incluir.ok) return falha(`Nada foi gravado. ${incluir.mensagem}`);
  const tirar = await resolverFabricas(args.tirar_fabricas);
  if (!tirar.ok) return falha(`Nada foi gravado. ${tirar.mensagem}`);
  const mudaFabricas = incluir.valor.length + tirar.valor.length > 0;
  if (mudaFabricas && empresa.situacao === "CLIENTE") {
    return falha("Nada foi gravado. Esta empresa já é cliente: as fábricas dela são as que compra. Para oferecer outra fábrica, use uma oportunidade da carteira.");
  }

  let passo: { passo: crm.PassoEntrada; responsavel: string } | null = null;
  if (args.proximo_passo) {
    const p = await lerPasso(usuario, args.proximo_passo, hoje);
    if (!p.ok) return falha(p.mensagem);
    passo = p;
  }
  let retomadaEm: string | null = null;
  if (args.retomada_em?.trim()) {
    retomadaEm = interpretarDia(args.retomada_em, hoje);
    if (!retomadaEm) return falha(`Não entendi a data de retomada ("${args.retomada_em}"). Use DD/MM/AAAA.`);
  }

  const contato = args.contato_novo;
  const resultado = await crm.registrarInteracao(autor(usuario), {
    clienteId: empresa.id,
    canal: maiusculo(args.canal) ?? "",
    resumo: args.resumo,
    comQuem: args.com_quem,
    resultado: args.resultado,
    data: quando.data,
    situacao: maiusculo(args.situacao),
    motivo: args.motivo,
    retomadaEm,
    proximoPasso: passo?.passo ?? null,
    semProximoPasso: args.sem_proximo_passo,
    naoContatar: args.nao_contatar,
    contatoNovo: contato
      ? {
          nome: contato.nome,
          funcao: contato.funcao,
          canal: maiusculo(contato.canal) ?? "",
          valor: contato.valor,
          servePara: contato.serve_para,
          fonte: contato.fonte?.trim() || fontePadrao(usuario),
          origemContato: maiusculo(contato.origem_contato) ?? null,
        }
      : null,
  });
  if (resultado.erros.length > 0) {
    const dica = resultado.erros.includes("Diga qual é o próximo passo.")
      ? " A empresa está em andamento: pergunte ao usuário o próximo passo (ação, data e responsável) e mande em proximo_passo, ou use sem_proximo_passo se ele disser que não há."
      : "";
    return falha(`Nada foi gravado. ${resultado.erros.join(" ")}${dica}`);
  }

  const canal = CANAL[maiusculo(args.canal) ?? ""] ?? args.canal;
  const feito = [`Anotado em ${nomeComLocal(empresa)}: ${canal} em ${formatarDia(quando.dia)} — ${args.resumo.trim()}`];
  if (contato) feito.push(`Contato novo: ${[contato.nome, contato.funcao, contato.valor].filter(Boolean).join(" · ")}`);
  if (args.nao_contatar) {
    feito.push('Marcada como NÃO CONTATAR: a empresa e os contatos dela não recebem mais mensagens; passos abertos foram encerrados.');
  } else {
    const nova = maiusculo(args.situacao);
    if (nova && nova !== empresa.situacao) feito.push(`Situação agora: ${rotuloSituacao(nova)}`);
    if (passo) feito.push(`Próximo passo: ${linhaPasso(passo.passo.acao, passo.passo.prazo, passo.responsavel)}`);
    else if (nova === "PAUSADA" && retomadaEm) feito.push(`Retomar em ${formatarDiaComSemana(retomadaEm)}.`);
    else if (args.sem_proximo_passo) feito.push("Sem próximo passo.");
  }
  if (mudaFabricas) {
    const f = await ajustarFabricasProspeccao(usuario, empresa.id, { incluir: incluir.valor.map((x) => x.id), tirar: tirar.valor.map((x) => x.id) });
    if (f.erros.length > 0) feito.push(`AVISO: as fábricas não mudaram. ${f.erros.join(" ")}`);
    else feito.push(`Prospecção para: ${f.fabricas?.length ? f.fabricas.join(", ") : "nenhuma fábrica"}`);
  }
  for (const aviso of resultado.avisos ?? []) feito.push(`AVISO: ${aviso}`);
  return { texto: feito.join("\n") };
}

// ---------------------------------------------------------------------------- agendar

export async function agendar(usuario: UsuarioSessao, args: { empresa: string } & PassoArgs): Promise<Resposta> {
  const hoje = hojeEmSaoPaulo();
  const r = await resolverEmpresa(args.empresa);
  if (!r.ok) return falha(r.mensagem);
  const p = await lerPasso(usuario, args, hoje);
  if (!p.ok) return falha(p.mensagem);
  const res = await crm.agendarProximoPasso(autor(usuario), { clienteId: r.valor.id, passo: p.passo });
  if (res.erros.length > 0) return falha(`Nada foi gravado. ${res.erros.join(" ")}`);
  return {
    texto: [`Próximo passo de ${nomeComLocal(r.valor)}: ${linhaPasso(p.passo.acao, p.passo.prazo, p.responsavel)}`, ...(res.substituido ? [`(Substituiu o passo anterior: ${res.substituido})`] : [])].join("\n"),
  };
}

// ---------------------------------------------------------------------------- concluir

export async function concluirProximoPasso(usuario: UsuarioSessao, args: { passo_id: string; proximo_passo?: PassoArgs }): Promise<Resposta> {
  const hoje = hojeEmSaoPaulo();
  let proximo: { passo: crm.PassoEntrada; responsavel: string } | null = null;
  if (args.proximo_passo) {
    const p = await lerPasso(usuario, args.proximo_passo, hoje);
    if (!p.ok) return falha(p.mensagem);
    proximo = p;
  }
  const res = await crm.concluirProximoPasso(autor(usuario), { id: args.passo_id.trim(), proximo: proximo?.passo ?? null });
  if (res.erros.length > 0) {
    const dica = res.erros.includes("Diga qual é o próximo passo.") ? " A empresa está em andamento: pergunte o próximo passo e mande em proximo_passo." : "";
    return falha(`Nada foi gravado. ${res.erros.join(" ")}${dica}`);
  }
  return { texto: ["Feito: passo concluído.", ...(proximo ? [`Próximo passo: ${linhaPasso(proximo.passo.acao, proximo.passo.prazo, proximo.responsavel)}`] : [])].join("\n") };
}

// ---------------------------------------------------------------------------- nova empresa

export async function novaEmpresa(
  usuario: UsuarioSessao,
  args: { nome: string; uf?: string; cidade?: string; cnpj?: string; site?: string; observacoes?: string; fabricas?: string[]; mesmo_assim?: boolean },
): Promise<Resposta> {
  const fabricas = await resolverFabricas(args.fabricas);
  if (!fabricas.ok) return falha(`Nada foi gravado. ${fabricas.mensagem}`);
  const r = await criarEmpresaProspeccao(autor(usuario), {
    nome: args.nome,
    uf: args.uf,
    cidade: args.cidade,
    cnpj: args.cnpj,
    site: args.site,
    observacoes: args.observacoes,
    fabricasIds: fabricas.valor.map((f) => f.id),
    mesmoAssim: args.mesmo_assim,
  });
  if (r.erros.length > 0) {
    const lista = r.parecidas?.map((p) => `- ${p.nome}${p.local ? ` (${p.local})` : ""} [${rotuloSituacao(p.situacao)}] · id: ${p.id}`) ?? [];
    const dica = r.parecidas && !r.erros[0].startsWith("Já existe uma empresa com este CNPJ") ? "\nSe o usuário confirmar que é outra empresa, repita com mesmo_assim: true." : "";
    return falha(`Nada foi gravado. ${r.erros.join(" ")}${lista.length ? `\n${lista.join("\n")}` : ""}${dica}`);
  }
  const local = [args.cidade?.trim(), args.uf?.trim().toUpperCase()].filter(Boolean).join("/");
  return {
    texto: [
      `Empresa cadastrada: ${args.nome.trim()}${local ? ` (${local})` : ""} — a avaliar · id: ${r.id}`,
      fabricas.valor.length ? `Prospecção para: ${fabricas.valor.map((f) => f.nome).sort().join(", ")}` : "Sem fábrica marcada: pergunte ao usuário para qual fábrica é a prospecção e marque com registrar_interacao (incluir_fabricas).",
      ...(r.avisos ?? []).map((a) => `AVISO: ${a}`),
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------- contato

export async function adicionarContato(
  usuario: UsuarioSessao,
  args: { empresa: string; canal: string; valor: string; nome?: string; funcao?: string; serve_para?: string; fonte?: string; origem_contato?: string; observacoes?: string },
): Promise<Resposta> {
  const r = await resolverEmpresa(args.empresa);
  if (!r.ok) return falha(r.mensagem);
  const res = await criarContato(usuario.id, {
    clienteId: r.valor.id,
    canal: maiusculo(args.canal) ?? "",
    valor: args.valor,
    nome: args.nome,
    funcao: args.funcao,
    servePara: args.serve_para,
    fonte: args.fonte?.trim() || fontePadrao(usuario),
    origemContato: maiusculo(args.origem_contato) ?? null,
    observacoes: args.observacoes,
  });
  if (res.erros.length > 0) return falha(`Nada foi gravado. ${res.erros.join(" ")}`);
  return { texto: `Contato salvo em ${nomeComLocal(r.valor)}: ${[args.nome, args.funcao, args.valor.trim()].filter(Boolean).join(" · ")} · id: ${res.id}` };
}
