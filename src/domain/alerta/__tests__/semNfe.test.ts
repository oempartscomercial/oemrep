import { describe, it, expect } from "vitest";
import { pedidosSemNfeVencidos, type PedidoParaAlerta } from "../semNfe";

const base: Omit<PedidoParaAlerta, "estado" | "criadoEm"> = {
  id: "p1",
  numero: "PED-1",
  fabrica: "Bowden",
  cliente: "Cliente A",
};

describe("pedidosSemNfeVencidos (RF34, ADR-006)", () => {
  const hoje = new Date("2026-07-16T12:00:00Z");

  it("sinaliza pedido SEM_NFE parado há mais do que o prazo (padrão 7 dias)", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "SEM_NFE", criadoEm: new Date("2026-07-01T12:00:00Z") }, // 15 dias
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje)).toEqual([
      { pedidoId: "p1", numero: "PED-1", fabrica: "Bowden", cliente: "Cliente A", diasSemNfe: 15 },
    ]);
  });

  it("ignora pedido SEM_NFE ainda dentro do prazo", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "SEM_NFE", criadoEm: new Date("2026-07-12T12:00:00Z") }, // 4 dias
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje)).toEqual([]);
  });

  it("ignora pedido que já tem nota (estado diferente de SEM_NFE)", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "PARCIAL", criadoEm: new Date("2026-06-01T12:00:00Z") },
      { ...base, id: "p2", estado: "COMPLETO", criadoEm: new Date("2026-06-01T12:00:00Z") },
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje)).toEqual([]);
  });

  it("respeita o prazo configurado", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "SEM_NFE", criadoEm: new Date("2026-07-06T12:00:00Z") }, // 10 dias
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje, 14)).toEqual([]);
    expect(pedidosSemNfeVencidos(pedidos, hoje, 10)).toHaveLength(1);
  });

  it("ordena do mais atrasado para o menos atrasado", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, id: "novo", estado: "SEM_NFE", criadoEm: new Date("2026-07-05T12:00:00Z") }, // 11
      { ...base, id: "velho", estado: "SEM_NFE", criadoEm: new Date("2026-06-01T12:00:00Z") }, // 45
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje).map((a) => a.pedidoId)).toEqual(["velho", "novo"]);
  });
});
