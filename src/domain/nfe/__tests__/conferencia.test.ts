import { describe, it, expect } from "vitest";
import { conferirItens, type PendenciaItem } from "../conferencia";
import type { ItemNFe } from "../parser";

const CNPJ_CLIENTE = "11222333000181";

const pendencia = (sobrescreve: Partial<PendenciaItem> = {}): PendenciaItem => ({
  itemPedidoId: "item-1",
  pedidoId: "pedido-1",
  clienteCnpj: CNPJ_CLIENTE,
  referencia: "REF-1",
  quantidadePendente: 10,
  valorUnitario: 25.5,
  ...sobrescreve,
});

const itemNFe = (sobrescreve: Partial<ItemNFe> = {}): ItemNFe => ({
  referencia: "REF-1",
  descricao: "Peça 1",
  quantidade: 10,
  valorUnitario: 25.5,
  ...sobrescreve,
});

describe("conferirItens (RN04)", () => {
  it("não sinaliza divergência quando tudo bate", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe()], [pendencia()]);
    expect(resultado.pendencia).not.toBeNull();
    expect(resultado.divergencias).toEqual([]);
  });

  it("sinaliza item não encontrado quando a referência não existe no cliente", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ referencia: "REF-X" })], [pendencia()]);
    expect(resultado.pendencia).toBeNull();
    expect(resultado.divergencias).toHaveLength(1);
  });

  it("sinaliza item não encontrado quando o CNPJ do destinatário não bate", () => {
    const [resultado] = conferirItens("00000000000000", [itemNFe()], [pendencia()]);
    expect(resultado.pendencia).toBeNull();
  });

  it("sinaliza divergência de valor unitário sem impedir o match", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ valorUnitario: 30 })], [pendencia()]);
    expect(resultado.pendencia).not.toBeNull();
    expect(resultado.divergencias.some((d) => d.includes("Valor unitário"))).toBe(true);
  });

  it("sinaliza divergência quando a quantidade faturada excede a pendente (RN06 é o caminho normal, não isto)", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ quantidade: 15 })], [pendencia({ quantidadePendente: 10 })]);
    expect(resultado.divergencias.some((d) => d.includes("Quantidade"))).toBe(true);
  });

  it("não sinaliza divergência quando a quantidade faturada é menor que a pendente (faturamento parcial normal)", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ quantidade: 4 })], [pendencia({ quantidadePendente: 10 })]);
    expect(resultado.divergencias).toEqual([]);
  });

  // A NFe traz vUnCom com mais de duas casas (o layout da SEFAZ permite até 10); o pedido
  // guarda Decimal(12,2). Comparar com !== acusava divergência em todo item, e a mensagem
  // imprimia os dois lados com toFixed(2) — dois números idênticos na tela.
  it("não sinaliza divergência quando os valores são iguais em centavos, mesmo com mais casas na NFe", () => {
    const [resultado] = conferirItens(
      CNPJ_CLIENTE,
      [itemNFe({ valorUnitario: 25.5031 })],
      [pendencia({ valorUnitario: 25.5 })],
    );
    expect(resultado.divergencias).toEqual([]);
  });

  it("sinaliza divergência de valor a partir de um centavo de diferença", () => {
    const [resultado] = conferirItens(
      CNPJ_CLIENTE,
      [itemNFe({ valorUnitario: 25.51 })],
      [pendencia({ valorUnitario: 25.5 })],
    );
    expect(resultado.divergencias.some((d) => d.includes("Valor unitário"))).toBe(true);
  });

  it("descreve a divergência de valor em reais no formato brasileiro", () => {
    const [resultado] = conferirItens(
      CNPJ_CLIENTE,
      [itemNFe({ valorUnitario: 1250.5 })],
      [pendencia({ valorUnitario: 1200 })],
    );
    expect(resultado.divergencias[0]).toContain("R$ 1.250,50");
    expect(resultado.divergencias[0]).toContain("R$ 1.200,00");
  });

  // A referência do pedido vem de planilha (e vai vir de PDF), então chega com espaço
  // sobrando e caixa trocada. Casar com === exato fazia toda a NFe virar "item não encontrado".
  it("casa a referência ignorando espaços em volta e caixa", () => {
    const [resultado] = conferirItens(
      CNPJ_CLIENTE,
      [itemNFe({ referencia: "ref-1" })],
      [pendencia({ referencia: "  REF-1 " })],
    );
    expect(resultado.pendencia).not.toBeNull();
    expect(resultado.divergencias).toEqual([]);
  });

  // Duas linhas det com o mesmo cProd casavam com o MESMO ItemPedido via .find(),
  // somando baixa em dobro e deixando a quantidade pendente negativa.
  it("não casa a mesma pendência com duas linhas da NFe", () => {
    const resultados = conferirItens(
      CNPJ_CLIENTE,
      [itemNFe({ quantidade: 6 }), itemNFe({ quantidade: 4 })],
      [pendencia()],
    );
    expect(resultados[0].pendencia?.itemPedidoId).toBe("item-1");
    expect(resultados[1].pendencia).toBeNull();
    expect(resultados[1].divergencias).toHaveLength(1);
  });

  // RN10: uma NFe cobre vários pedidos do mesmo cliente. Duas linhas com a mesma
  // referência devem consumir as pendências de pedidos diferentes, uma cada.
  it("distribui linhas de mesma referência entre pendências de pedidos diferentes", () => {
    const resultados = conferirItens(
      CNPJ_CLIENTE,
      [itemNFe({ quantidade: 10 }), itemNFe({ quantidade: 10 })],
      [
        pendencia({ itemPedidoId: "item-1", pedidoId: "pedido-1" }),
        pendencia({ itemPedidoId: "item-2", pedidoId: "pedido-2" }),
      ],
    );
    expect(resultados[0].pendencia?.pedidoId).toBe("pedido-1");
    expect(resultados[1].pendencia?.pedidoId).toBe("pedido-2");
    expect(resultados.flatMap((r) => r.divergencias)).toEqual([]);
  });
});
