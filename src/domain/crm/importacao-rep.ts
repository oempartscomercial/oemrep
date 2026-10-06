import { normalizarCnpj } from "../cadastro/cnpj";

// Converte os arquivos CSV da pasta operacional do Rômulo (rep/dados) para os dados do
// CRM (ADR-013). Nada é adivinhado: valor desconhecido interrompe a importação.

export type Linha = Record<string, string>;

export type SituacaoEmpresa =
  | "CANDIDATA"
  | "APROVADA"
  | "EM_CONTATO"
  | "CONVERSANDO"
  | "AVANCO"
  | "PAUSADA"
  | "DESCARTADA"
  | "CLIENTE";
export type CanalContato = "WHATSAPP" | "TELEFONE" | "EMAIL" | "LINKEDIN" | "OUTRO";
export type CanalInteracao = "WHATSAPP" | "TELEFONE" | "EMAIL" | "VISITA" | "REUNIAO" | "PESQUISA" | "OUTRO";

const SITUACOES: Record<string, SituacaoEmpresa> = {
  candidata: "CANDIDATA",
  aprovada: "APROVADA",
  em_contato: "EM_CONTATO",
  conversando: "CONVERSANDO",
  avanco: "AVANCO",
  pausada: "PAUSADA",
  descartada: "DESCARTADA",
  cliente: "CLIENTE",
};

const CANAIS_CONTATO: Record<string, CanalContato> = {
  whatsapp: "WHATSAPP",
  telefone: "TELEFONE",
  email: "EMAIL",
  linkedin: "LINKEDIN",
  outro: "OUTRO",
};

const CANAIS_INTERACAO: Record<string, CanalInteracao> = {
  whatsapp: "WHATSAPP",
  telefone: "TELEFONE",
  email: "EMAIL",
  visita: "VISITA",
  reuniao: "REUNIAO",
  pesquisa: "PESQUISA",
  outro: "OUTRO",
};

const NOMES_FABRICA: Record<string, string> = {
  "SEINECA - H3 COMERCIO": "Seineca/H3",
};

export function lerCsv(texto: string): Linha[] {
  const registros: string[][] = [];
  let campo = "";
  let registro: string[] = [];
  let entreAspas = false;
  const conteudo = texto.replace(/^﻿/, "");

  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (entreAspas) {
      if (c === '"' && conteudo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === ",") {
      registro.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && conteudo[i + 1] === "\n") i++;
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || registro.length > 0) {
    registro.push(campo);
    registros.push(registro);
  }

  const [cabecalho, ...dados] = registros.filter((r) => !(r.length === 1 && r[0] === ""));
  if (!cabecalho) return [];
  return dados.map((r) => Object.fromEntries(cabecalho.map((nome, i) => [nome, r[i] ?? ""])));
}

function textoOuNulo(valor: string | undefined): string | null {
  const limpo = (valor ?? "").trim();
  return limpo === "" ? null : limpo;
}

function data(valor: string, onde: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) throw new Error(`${onde}: data inválida "${valor}"`);
  return new Date(`${valor.trim()}T00:00:00.000Z`);
}

function traduzir<T>(mapa: Record<string, T>, valor: string, onde: string, oQue: string): T {
  const traduzido = mapa[valor.trim().toLowerCase()];
  if (traduzido === undefined) throw new Error(`${onde}: ${oQue} desconhecido(a) "${valor}"`);
  return traduzido;
}

export function mapearConta(linha: Linha) {
  const onde = `conta ${linha.conta_id}`;
  const acao = textoOuNulo(linha.proxima_acao);
  const prazo = textoOuNulo(linha.prazo);
  return {
    chave: linha.conta_id,
    nomeFantasia: linha.nome.trim(),
    cnpj: textoOuNulo(linha.cnpj) ? normalizarCnpj(linha.cnpj) : null,
    situacao: traduzir(SITUACOES, linha.situacao, onde, "situação"),
    cidade: textoOuNulo(linha.cidade),
    uf: textoOuNulo(linha.uf),
    site: textoOuNulo(linha.site),
    grupo: textoOuNulo(linha.grupo),
    observacoes: textoOuNulo(linha.observacoes),
    proximoPasso: acao && prazo ? { acao, prazo: data(prazo, onde), dono: linha.dono.trim() } : null,
  };
}

export function mapearContato(linha: Linha) {
  const onde = `contato da conta ${linha.conta_id}`;
  const fonte = textoOuNulo(linha.fonte);
  if (!fonte) throw new Error(`${onde}: contato sem fonte`);
  return {
    chaveConta: linha.conta_id,
    nome: textoOuNulo(linha.nome),
    funcao: textoOuNulo(linha.funcao),
    canal: traduzir(CANAIS_CONTATO, linha.canal, onde, "canal"),
    valor: linha.valor.trim(),
    servePara: textoOuNulo(linha.serve_para),
    status: textoOuNulo(linha.status),
    fonte,
    verificadoEm: textoOuNulo(linha.verificado_em) ? data(linha.verificado_em, onde) : null,
    naoContatar: textoOuNulo(linha.nao_contatar) !== null,
    observacoes: textoOuNulo(linha.observacoes),
  };
}

export function mapearInteracao(linha: Linha) {
  const onde = `interação da conta ${linha.conta_id}`;
  return {
    chaveConta: linha.conta_id,
    data: data(linha.data, onde),
    canal: traduzir(CANAIS_INTERACAO, linha.canal, onde, "canal"),
    comQuem: textoOuNulo(linha.com_quem),
    resumo: linha.resumo.trim(),
    resultado: textoOuNulo(linha.resultado),
  };
}

export function mapearPedidoHistorico(linha: Linha) {
  const onde = `pedido da linha ${linha.linha_planilha}`;
  const valor = linha.valor_sem_imposto.trim();
  if (!/^-?\d+(\.\d+)?$/.test(valor)) throw new Error(`${onde}: valor inválido "${valor}"`);
  const alerta = textoOuNulo(linha.alerta);
  return {
    chaveConta: linha.conta_id,
    linhaPlanilha: Number(linha.linha_planilha),
    data: data(linha.data, onde),
    dataSoMes: alerta?.startsWith("dia 1") ?? false,
    fabricante: linha.fabricante.trim(),
    valor,
    tipo: linha.tipo.trim() === "bonificacao" ? ("BONIFICACAO" as const) : ("PEDIDO" as const),
    rotuloPlanilha: linha.cliente_planilha.trim(),
    suspeitaDuplicidade: alerta?.includes("repetido") ?? false,
    alerta,
  };
}

export function nomeFabrica(fabricante: string): string {
  const chave = fabricante.trim();
  if (NOMES_FABRICA[chave]) return NOMES_FABRICA[chave];
  return chave.charAt(0) + chave.slice(1).toLowerCase();
}
