import { describe, it, expect } from "vitest";
import { aplicarVinculosManuais } from "../conferencia";
import type { PendenciaItem } from "../conferencia";

const CNPJ = "11222333000181";
const pendencia = (id: string, referencia: string, quantidadePendente: number, valorUnitario = 10): PendenciaItem => ({
  itemPedidoId: id,
  pedidoId: `ped-${id}`,
  clienteCnpj: CNPJ,
  referencia,
  quantidadePendente,
  valorUnitario,
});
const itens = [
  { referencia: "REF-NOVA", descricao: "Peça renomeada", quantidade: 2, valorUnitario: 10 },
  { referencia: "REF-2", descricao: "Outra", quantidade: 1, valorUnitario: 10 },
];
const pendencias = [pendencia("i1", "REF-1", 5), pendencia("i2", "REF-2", 1)];

describe("aplicarVinculosManuais (RF16)", () => {
  it("sem escolha manual, mantém o casamento automático por referência", () => {
    const resultado = aplicarVinculosManuais(CNPJ, itens, pendencias, {});
    expect(resultado.erro).toBeUndefined();
    expect(resultado.conferencia?.map((r) => r.pendencia?.itemPedidoId ?? null)).toEqual([null, "i2"]);
  });

  it("vincula manualmente um item que não casou e recalcula as divergências", () => {
    const resultado = aplicarVinculosManuais(CNPJ, itens, pendencias, { 0: "i1" });
    expect(resultado.conferencia?.[0].pendencia?.itemPedidoId).toBe("i1");
    expect(resultado.conferencia?.[0].divergencias).toEqual(["Referência diferente: NFe REF-NOVA × pedido REF-1 (vínculo manual)."]);
  });

  it("desfaz um vínculo automático", () => {
    const resultado = aplicarVinculosManuais(CNPJ, itens, pendencias, { 1: null });
    expect(resultado.conferencia?.[1].pendencia).toBeNull();
    expect(resultado.conferencia?.[1].divergencias).toEqual(["Item não será baixado (vínculo removido)."]);
  });

  it("recusa vínculo com item que não está entre as pendências do cliente nesta fábrica", () => {
    expect(aplicarVinculosManuais(CNPJ, itens, pendencias, { 0: "item-de-outro-cliente" })).toEqual({
      erro: "Um dos vínculos escolhidos não é um item pendente deste cliente nesta fábrica.",
    });
  });
});
