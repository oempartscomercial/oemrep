import { describe, it, expect } from "vitest";
import { extrairNFeDoXml } from "../parser";

const XML_DOIS_ITENS = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260711444777000161550010000012341123456789" versao="4.00">
      <ide>
        <nNF>1234</nNF>
        <dhEmi>2026-07-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>11444777000161</CNPJ>
      </emit>
      <dest>
        <CNPJ>11222333000181</CNPJ>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>REF-1</cProd>
          <xProd>Peça 1</xProd>
          <qCom>10.0000</qCom>
          <vUnCom>25.50</vUnCom>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>REF-2</cProd>
          <xProd>Peça 2</xProd>
          <qCom>5.0000</qCom>
          <vUnCom>12.00</vUnCom>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>315.00</vProd>
          <vNF>320.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

const XML_UM_ITEM = XML_DOIS_ITENS.replace(
  /<det nItem="2">[\s\S]*?<\/det>\s*/,
  "",
);

describe("extrairNFeDoXml", () => {
  it("extrai cabeçalho e itens de uma NFe com múltiplos itens", () => {
    const nfe = extrairNFeDoXml(XML_DOIS_ITENS);

    expect(nfe.chaveAcesso).toBe("35260711444777000161550010000012341123456789");
    expect(nfe.numero).toBe("1234");
    expect(nfe.emitenteCnpj).toBe("11444777000161");
    expect(nfe.destinatarioCnpj).toBe("11222333000181");
    expect(nfe.totalProdutos).toBe(315);
    expect(nfe.totalNota).toBe(320);
    expect(nfe.itens).toHaveLength(2);
    expect(nfe.itens[0]).toEqual({
      referencia: "REF-1",
      descricao: "Peça 1",
      quantidade: 10,
      valorUnitario: 25.5,
    });
  });

  it("normaliza NFe com um único item (o parser não retorna array nesse caso)", () => {
    const nfe = extrairNFeDoXml(XML_UM_ITEM);

    expect(nfe.itens).toHaveLength(1);
    expect(nfe.itens[0].referencia).toBe("REF-1");
  });

  it("lança erro para XML que não é uma NFe", () => {
    expect(() => extrairNFeDoXml("<algo><outraCoisa/></algo>")).toThrow(/NFe válida/);
  });
});
