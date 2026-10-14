import { describe, it, expect } from "vitest";
import { analisarCarteira, type CompraDaCarteira } from "../carteira";

const compra = (clienteId: string, data: string, valor: number, fabrica = "Bowden", dataSoMes = false): CompraDaCarteira => ({
  clienteId,
  data,
  valor,
  fabrica,
  dataSoMes,
});

describe("analisarCarteira (sinais para conferir, não previsão)", () => {
  const hoje = "2026-10-14";

  it("cliente com ritmo (3+ datas) está atrasado quando passa do dobro do intervalo normal, com mínimo de 45 dias", () => {
    // Intervalos de 30 dias → limite max(60, 45) = 60. Última compra há 74 dias.
    const r = analisarCarteira([compra("a", "2026-06-02", 100), compra("a", "2026-07-02", 100), compra("a", "2026-08-01", 100)], hoje);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ clienteId: "a", estado: "atrasado", ritmoDias: 30, diasSemComprar: 74, compras: 3, pedidos: 3, valor: 300 });
  });

  it("com ritmo curto, o mínimo de 45 dias segura o alarme", () => {
    // Intervalos de 10 dias → limite 45. Última compra há 40 dias: em dia.
    const r = analisarCarteira([compra("a", "2026-08-15", 1), compra("a", "2026-08-25", 1), compra("a", "2026-09-04", 1)], hoje);
    expect(r[0].estado).toBe("em_dia");
  });

  it("1 ou 2 datas de compra: 'não voltou' depois de 60 dias, senão recente", () => {
    const r = analisarCarteira([compra("velho", "2026-07-01", 50), compra("novo", "2026-09-20", 80)], hoje);
    const porId = Object.fromEntries(r.map((i) => [i.clienteId, i]));
    expect(porId.velho.estado).toBe("sumiu");
    expect(porId.velho.ritmoDias).toBeNull();
    expect(porId.novo.estado).toBe("recente");
  });

  it("vários pedidos no mesmo dia contam como uma data de compra; soma por fábrica; maior valor primeiro", () => {
    const r = analisarCarteira(
      [compra("a", "2026-10-01", 10, "Bowden"), compra("a", "2026-10-01", 20, "Autoflex"), compra("b", "2026-10-02", 500)],
      hoje,
    );
    expect(r.map((i) => i.clienteId)).toEqual(["b", "a"]);
    expect(r[1]).toMatchObject({ compras: 1, pedidos: 2, valor: 30, porFabrica: { Autoflex: 20, Bowden: 10 } });
  });

  it("avisa quando a última data pode ser só o mês (dia 1 da planilha)", () => {
    const r = analisarCarteira([compra("a", "2026-09-01", 10, "Bowden", true)], hoje);
    expect(r[0].ultimaCompra).toBe("2026-09-01");
    expect(r[0].ultimaAproximada).toBe(true);
  });
});
