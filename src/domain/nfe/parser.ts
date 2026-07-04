import { XMLParser } from "fast-xml-parser";

export type ItemNFe = {
  referencia: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type NFeExtraida = {
  chaveAcesso: string;
  numero: string;
  emitenteCnpj: string;
  destinatarioCnpj: string;
  dataEmissao: string;
  totalProdutos: number;
  totalNota: number;
  itens: ItemNFe[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (nome) => nome === "det",
});

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

function numero(valor: unknown): number {
  return Number(valor ?? 0);
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

  return {
    chaveAcesso: extrairChaveDoId(texto(campo(infNFe, "@_Id"))),
    numero: texto(campo(infNFe, "ide", "nNF")),
    emitenteCnpj: texto(campo(infNFe, "emit", "CNPJ")),
    destinatarioCnpj: texto(campo(infNFe, "dest", "CNPJ")),
    dataEmissao: texto(campo(infNFe, "ide", "dhEmi")),
    totalProdutos: numero(campo(infNFe, "total", "ICMSTot", "vProd")),
    totalNota: numero(campo(infNFe, "total", "ICMSTot", "vNF")),
    itens: det.map((item) => ({
      referencia: texto(campo(item, "prod", "cProd")),
      descricao: texto(campo(item, "prod", "xProd")),
      quantidade: numero(campo(item, "prod", "qCom")),
      valorUnitario: numero(campo(item, "prod", "vUnCom")),
    })),
  };
}
