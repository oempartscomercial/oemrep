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

// NFe mínima montada com trechos inline (det, transp, infCpl) para os casos de transporte e pedido.
function montarNFe(
  trechos: { det?: string; transp?: string; infCpl?: string; emitCnpj?: string } = {},
): string {
  const { det = "", transp = "", infCpl = "", emitCnpj = "11444777000161" } = trechos;
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260711444777000161550010000012341123456789" versao="4.00">
      <ide>
        <nNF>1234</nNF>
        <dhEmi>2026-07-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>${emitCnpj}</CNPJ>
      </emit>
      <dest>
        <CNPJ>11222333000181</CNPJ>
      </dest>
      ${det}
      <total>
        <ICMSTot>
          <vProd>315.00</vProd>
          <vNF>320.00</vNF>
        </ICMSTot>
      </total>
      ${transp}
      ${infCpl ? `<infAdic>\n        <infCpl>${infCpl}</infCpl>\n      </infAdic>` : ""}
    </infNFe>
  </NFe>
</nfeProc>`;
}

const DET_SIMPLES = `<det nItem="1">
        <prod>
          <cProd>REF-1</cProd>
          <xProd>Peça 1</xProd>
          <qCom>10.0000</qCom>
          <vUnCom>25.50</vUnCom>
        </prod>
      </det>`;

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
      pedidoCliente: null,
      itemPedidoCliente: null,
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

  describe("transporte", () => {
    it("extrai transportadora (CNPJ e nome), modalidade do frete, volumes e peso", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          transp: `<transp>
        <modFrete>1</modFrete>
        <transporta>
          <CNPJ>22333444000155</CNPJ>
          <xNome>TRANSPORTES RAPIDO LTDA</xNome>
        </transporta>
        <vol>
          <qVol>3</qVol>
          <pesoB>12.500</pesoB>
        </vol>
      </transp>`,
        }),
      );

      expect(nfe.transportadora).toEqual({ cnpj: "22333444000155", nome: "TRANSPORTES RAPIDO LTDA" });
      expect(nfe.modalidadeFrete).toBe("1");
      expect(nfe.volumes).toBe(3);
      expect(nfe.pesoBruto).toBe(12.5);
    });

    it("aceita CPF no lugar de CNPJ para a transportadora", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          transp: `<transp>
        <modFrete>0</modFrete>
        <transporta>
          <CPF>12345678909</CPF>
          <xNome>JOSE MOTORISTA</xNome>
        </transporta>
      </transp>`,
        }),
      );

      expect(nfe.transportadora).toEqual({ cnpj: "12345678909", nome: "JOSE MOTORISTA" });
    });

    it("preserva modalidade '0' como texto (não vira falsy/null)", () => {
      const nfe = extrairNFeDoXml(montarNFe({ transp: "<transp><modFrete>0</modFrete></transp>" }));

      expect(nfe.modalidadeFrete).toBe("0");
    });

    it("devolve transportadora null, frete e volumes null quando não há bloco transp", () => {
      const nfe = extrairNFeDoXml(montarNFe());

      expect(nfe.transportadora).toBeNull();
      expect(nfe.modalidadeFrete).toBeNull();
      expect(nfe.volumes).toBeNull();
      expect(nfe.pesoBruto).toBeNull();
    });

    it("devolve transportadora null quando transporta existe sem CNPJ/CPF nem nome", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          transp: `<transp>
        <transporta>
          <IE>123456</IE>
        </transporta>
      </transp>`,
        }),
      );

      expect(nfe.transportadora).toBeNull();
    });

    it("soma vários <vol> quando o XML traz uma lista deles", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          transp: `<transp>
        <vol>
          <qVol>2</qVol>
          <pesoB>10.250</pesoB>
        </vol>
        <vol>
          <qVol>5</qVol>
          <pesoB>4.750</pesoB>
        </vol>
      </transp>`,
        }),
      );

      expect(nfe.volumes).toBe(7);
      expect(nfe.pesoBruto).toBe(15);
    });

    it("devolve volumes e peso null quando os <vol> não trazem qVol nem pesoB", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({ transp: "<transp><vol><esp>CAIXA</esp></vol></transp>" }),
      );

      expect(nfe.volumes).toBeNull();
      expect(nfe.pesoBruto).toBeNull();
    });
  });

  describe("pedido do cliente", () => {
    it("lê xPed e nItemPed de cada item, null quando ausentes", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          det: `<det nItem="1">
        <prod>
          <cProd>REF-1</cProd>
          <xProd>Peça 1</xProd>
          <qCom>10.0000</qCom>
          <vUnCom>25.50</vUnCom>
          <xPed>4504364932</xPed>
          <nItemPed>10</nItemPed>
        </prod>
      </det>
      ${DET_SIMPLES.replace('nItem="1"', 'nItem="2"').replace("REF-1", "REF-2")}`,
        }),
      );

      expect(nfe.itens[0]).toMatchObject({ pedidoCliente: "4504364932", itemPedidoCliente: "10" });
      expect(nfe.itens[1]).toMatchObject({ pedidoCliente: null, itemPedidoCliente: null });
    });

    it("preserva zeros à esquerda em xPed, cProd e CNPJ do emitente", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          emitCnpj: "01234567000189",
          det: `<det nItem="1">
        <prod>
          <cProd>0123</cProd>
          <xProd>Peça 1</xProd>
          <qCom>1.0000</qCom>
          <vUnCom>1.00</vUnCom>
          <xPed>00123</xPed>
        </prod>
      </det>`,
        }),
      );

      expect(nfe.emitenteCnpj).toBe("01234567000189");
      expect(nfe.itens[0].referencia).toBe("0123");
      expect(nfe.itens[0].pedidoCliente).toBe("00123");
      expect(nfe.pedidosReferidos).toEqual(["00123"]);
    });

    it("extrai o pedido do Autoflex a partir do infCpl", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({ infCpl: "PEDIDO DO CLIENTE - 4504364932" }),
      );

      expect(nfe.pedidosReferidos).toEqual(["4504364932"]);
    });

    it("reconhece os padrões PED/PEDIDO Nº, ORDEM DE COMPRA e O.C. no infCpl", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          infCpl: "Ref. PED. Nº 4286; ORDEM DE COMPRA: 77/2026. O.C.: 0.2385",
        }),
      );

      expect(nfe.pedidosReferidos).toEqual(["4286", "77/2026", "0.2385"]);
    });

    it("é case-insensitive e remove pontuação final do número", () => {
      const nfe = extrairNFeDoXml(montarNFe({ infCpl: "pedido do cliente: 123-. Ordem de compra 456," }));

      expect(nfe.pedidosReferidos).toEqual(["123", "456"]);
    });

    it("não casa 'OC' dentro de outra palavra", () => {
      const nfe = extrairNFeDoXml(montarNFe({ infCpl: "PROC 12 ANEXO" }));

      expect(nfe.pedidosReferidos).toEqual([]);
    });

    it("junta xPed dos itens com o infCpl, sem repetir número", () => {
      const nfe = extrairNFeDoXml(
        montarNFe({
          det: `<det nItem="1">
        <prod>
          <cProd>REF-1</cProd>
          <xProd>Peça 1</xProd>
          <qCom>1.0000</qCom>
          <vUnCom>1.00</vUnCom>
          <xPed>4504364932</xPed>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>REF-2</cProd>
          <xProd>Peça 2</xProd>
          <qCom>1.0000</qCom>
          <vUnCom>1.00</vUnCom>
          <xPed>4286</xPed>
        </prod>
      </det>`,
          infCpl: "PEDIDO DO CLIENTE - 4504364932 / PED 4286",
        }),
      );

      expect(nfe.pedidosReferidos).toEqual(["4504364932", "4286"]);
    });
  });
});
