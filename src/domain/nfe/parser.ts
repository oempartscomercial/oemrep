import { XMLParser } from "fast-xml-parser";

export type ItemNFe = {
  referencia: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  // Pedido de compra do cliente, quando a NFe traz (prod.xPed / prod.nItemPed).
  // Opcionais para não quebrar quem monta ItemNFe à mão (ex.: testes).
  pedidoCliente?: string | null;
  itemPedidoCliente?: string | null;
};

export type NFeExtraida = {
  chaveAcesso: string;
  numero: string;
  emitenteCnpj: string;
  destinatarioCnpj: string;
  dataEmissao: string;
  totalProdutos: number;
  totalNota: number;
  transportadora: { cnpj: string; nome: string } | null;
  modalidadeFrete: string | null;
  volumes: number | null;
  pesoBruto: number | null;
  pedidosReferidos: string[];
  itens: ItemNFe[];
};

// parseTagValue: false mantém todo valor de tag como texto. Com o padrão (true),
// CNPJ/cProd/xPed com zero à esquerda perdem o zero ("0123" vira 123). Os campos
// numéricos passam por numero(), que já converte string com Number().
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (nome) => nome === "det",
  parseTagValue: false,
});

// Padrões de número de pedido citados no texto livre (infAdic.infCpl). Case-insensitive.
// O \b evita casar no meio de palavra (ex.: "PROC 12" não vira pedido "OC 12").
const PADROES_PEDIDO_INFCPL: RegExp[] = [
  /\bPEDIDO DO CLIENTE[:\s-]*([\w./-]+)/gi,
  /\bPED(?:IDO)?\.?\s*(?:N[º°o.]?\s*)?[:\s-]*(\d[\w./-]*)/gi,
  /\bORDEM DE COMPRA[:\s-]*([\w./-]+)/gi,
  /\bO\.?C\.?[:\s-]+(\d[\w./-]*)/gi,
];

function campo(obj: unknown, ...caminho: string[]): unknown {
  let atual = obj;
  for (const chave of caminho) {
    if (atual === null || typeof atual !== "object") return undefined;
    atual = (atual as Record<string, unknown>)[chave];
  }
  return atual;
}

function texto(valor: unknown): string {
  return valor === undefined || valor === null ? "" : String(valor);
}

function textoOuNulo(valor: unknown): string | null {
  const limpo = texto(valor).trim();
  return limpo === "" ? null : limpo;
}

function numero(valor: unknown): number {
  return Number(valor ?? 0);
}

// Soma uma propriedade de todos os <vol>. Devolve null se nenhum <vol> tem o campo.
function somarVolumes(vols: unknown[], chave: string): number | null {
  let total = 0;
  let encontrou = false;
  for (const vol of vols) {
    const valor = textoOuNulo(campo(vol, chave));
    if (valor === null) continue;
    const n = Number(valor);
    if (!Number.isFinite(n)) continue;
    total += n;
    encontrou = true;
  }
  return encontrou ? Math.round(total * 1000) / 1000 : null;
}

function extrairTransportadora(infNFe: unknown): NFeExtraida["transportadora"] {
  const transporta = campo(infNFe, "transp", "transporta");
  if (transporta === null || typeof transporta !== "object") return null;

  // Transportadora pessoa física informa CPF no lugar de CNPJ.
  const cnpj = textoOuNulo(campo(transporta, "CNPJ")) ?? textoOuNulo(campo(transporta, "CPF"));
  const nome = textoOuNulo(campo(transporta, "xNome"));
  if (cnpj === null && nome === null) return null;

  return { cnpj: cnpj ?? "", nome: nome ?? "" };
}

function extrairVolumes(infNFe: unknown): { volumes: number | null; pesoBruto: number | null } {
  const volBruto = campo(infNFe, "transp", "vol");
  // Com um único <vol> o parser devolve objeto; com vários, array (vol não entra no isArray).
  const vols: unknown[] =
    volBruto === undefined || volBruto === null ? [] : Array.isArray(volBruto) ? volBruto : [volBruto];

  return {
    volumes: somarVolumes(vols, "qVol"),
    pesoBruto: somarVolumes(vols, "pesoB"),
  };
}

function extrairPedidosReferidos(infNFe: unknown, det: unknown[]): string[] {
  const pedidos = new Set<string>();

  const adicionar = (valor: string | null) => {
    if (valor === null) return;
    const limpo = valor.trim().replace(/[.,;-]+$/, "");
    // Número de pedido tem dígito; "CONFORME ANEXO" depois de "PEDIDO DO CLIENTE:" não é.
    if (/\d/.test(limpo)) pedidos.add(limpo);
  };

  for (const item of det) {
    adicionar(textoOuNulo(campo(item, "prod", "xPed")));
  }

  const infCpl = texto(campo(infNFe, "infAdic", "infCpl"));
  for (const padrao of PADROES_PEDIDO_INFCPL) {
    for (const casamento of infCpl.matchAll(padrao)) {
      adicionar(casamento[1] ?? null);
    }
  }

  return [...pedidos];
}

function extrairChaveDoId(id: string): string {
  return id.replace(/^NFe/, "");
}

// RF12: extrai emitente/destinatário, chave de acesso, itens, quantidades e valores
// de um XML de NFe. Meta de performance: < 5 s (PRD §6.1) — não testado aqui pois
// XMLParser síncrono sobre um único documento é ordens de magnitude mais rápido.
export function extrairNFeDoXml(xml: string): NFeExtraida {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const infNFe = campo(doc, "nfeProc", "NFe", "infNFe") ?? campo(doc, "NFe", "infNFe");

  if (!infNFe || typeof infNFe !== "object") {
    throw new Error("XML não é uma NFe válida: elemento infNFe não encontrado.");
  }

  const detBruto = campo(infNFe, "det");
  const det = Array.isArray(detBruto) ? detBruto : [];
  const { volumes, pesoBruto } = extrairVolumes(infNFe);

  return {
    chaveAcesso: extrairChaveDoId(texto(campo(infNFe, "@_Id"))),
    numero: texto(campo(infNFe, "ide", "nNF")),
    emitenteCnpj: texto(campo(infNFe, "emit", "CNPJ")),
    destinatarioCnpj: texto(campo(infNFe, "dest", "CNPJ")),
    dataEmissao: texto(campo(infNFe, "ide", "dhEmi")),
    totalProdutos: numero(campo(infNFe, "total", "ICMSTot", "vProd")),
    totalNota: numero(campo(infNFe, "total", "ICMSTot", "vNF")),
    transportadora: extrairTransportadora(infNFe),
    modalidadeFrete: textoOuNulo(campo(infNFe, "transp", "modFrete")),
    volumes,
    pesoBruto,
    pedidosReferidos: extrairPedidosReferidos(infNFe, det),
    itens: det.map((item) => ({
      referencia: texto(campo(item, "prod", "cProd")),
      descricao: texto(campo(item, "prod", "xProd")),
      quantidade: numero(campo(item, "prod", "qCom")),
      valorUnitario: numero(campo(item, "prod", "vUnCom")),
      pedidoCliente: textoOuNulo(campo(item, "prod", "xPed")),
      itemPedidoCliente: textoOuNulo(campo(item, "prod", "nItemPed")),
    })),
  };
}
