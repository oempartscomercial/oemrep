import { describe, it, expect } from "vitest";
import { diasDesde, saldoAFaturar, valorDoPedido } from "../valor";

const item = (q: number, f: number, v: number, status: "PENDENTE" | "OK" | "FORA_DE_FABRICACAO" | "DESISTENCIA" = "PENDENTE") => ({
  quantidadePedida: q,
  quantidadeFaturada: f,
  valorUnitario: v,
  status,
});

describe("valorDoPedido", () => {
  it("soma os itens", () => {
    expect(valorDoPedido({ estado: "SEM_NFE", itens: [item(2, 0, 10.5), item(3, 0, 1.1)], valorTotalDeclarado: 999 })).toBe(24.3);
  });
  it("pedido rápido vale o total declarado", () => {
    expect(valorDoPedido({ estado: "SEM_NFE", itens: [], valorTotalDeclarado: "18611.00" })).toBe(18611);
  });
});

describe("saldoAFaturar", () => {
  it("sem nota: tudo", () => {
    expect(saldoAFaturar({ estado: "SEM_NFE", itens: [item(2, 0, 10)], valorTotalDeclarado: null })).toBe(20);
  });
  it("parcial: só o pendente, ignorando fora de fabricação e desistência", () => {
    const p = { estado: "PARCIAL" as const, itens: [item(10, 4, 5), item(1, 1, 100, "OK"), item(3, 0, 7, "FORA_DE_FABRICACAO"), item(2, 0, 9, "DESISTENCIA")], valorTotalDeclarado: null };
    expect(saldoAFaturar(p)).toBe(30);
  });
  it("rápido sem nota vale o declarado; completo e arquivado valem zero", () => {
    expect(saldoAFaturar({ estado: "SEM_NFE", itens: [], valorTotalDeclarado: 500 })).toBe(500);
    expect(saldoAFaturar({ estado: "COMPLETO", itens: [item(1, 0, 10)], valorTotalDeclarado: null })).toBe(0);
    expect(saldoAFaturar({ estado: "ARQUIVADO", itens: [], valorTotalDeclarado: 500 })).toBe(0);
  });
});

describe("diasDesde", () => {
  it("conta dias corridos e nunca negativo", () => {
    const agora = new Date("2026-10-09T12:00:00Z");
    expect(diasDesde(new Date("2026-10-01T12:00:00Z"), agora)).toBe(8);
    expect(diasDesde(new Date("2026-10-10T12:00:00Z"), agora)).toBe(0);
  });
});
