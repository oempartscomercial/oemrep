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
});
