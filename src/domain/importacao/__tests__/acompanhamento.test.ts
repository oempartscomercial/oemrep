import { describe, it, expect } from "vitest";
import {
  lerCnpj,
  lerLinhasAcompanhamento,
  lerNumeroPedido,
  lerSituacao,
  nomeDoCliente,
  pedidosEmAberto,
  type LinhaAcompanhamento,
} from "../acompanhamento";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const linha = (l: Partial<LinhaAcompanhamento>): LinhaAcompanhamento => ({
  cnpj: "07965809000520",
  fantasia: "FILIAL-04",
  dataPedido: d("2026-08-01"),
  numero: "4502182628",
  referencia: "7036",
  quantidadePedida: 10,
  quantidadePendente: 0,
  valorUnitario: 100,
  situacao: "OK",
  ...l,
});

describe("leitura das células", () => {
  it("CNPJ numérico recupera o zero à esquerda", () => {
    expect(lerCnpj(7965809000520)).toBe("07965809000520");
    expect(lerCnpj("")).toBeNull();
  });
  it("S/NUMERO vira pedido sem número", () => {
    expect(lerNumeroPedido("S/NUMERO")).toBeNull();
    expect(lerNumeroPedido(4502182628)).toBe("4502182628");
  });
  it("situações da planilha", () => {
    expect(lerSituacao("FORA DE FABRICAÇÃO")).toBe("FORA_DE_FABRICACAO");
    expect(lerSituacao("DESISTENCIA")).toBe("DESISTENCIA");
    expect(lerSituacao(" pendente ")).toBe("PENDENTE");
    expect(lerSituacao("???")).toBeNull();
  });
});

describe("nomeDoCliente", () => {
  it("filial da Padre Cícero ganha o nome da rede", () => {
    expect(nomeDoCliente("07965809000520", "FILIAL-04")).toEqual({ cnpj: "07965809000520", nomeFantasia: "PADRE CÍCERO FILIAL-04", uf: null });
  });
  it("tira a UF do fim do nome", () => {
    expect(nomeDoCliente("03675562000123", "AGRIMAH - MA")).toMatchObject({ nomeFantasia: "AGRIMAH - MA", uf: "MA" });
  });
});

describe("pedidosEmAberto", () => {
  it("só traz pedido com item pendente e calcula faturado, estado e saldo", () => {
    const pedidos = pedidosEmAberto([
      linha({ referencia: "A", situacao: "OK" }),
      linha({ referencia: "B", situacao: "PENDENTE", quantidadePedida: 10, quantidadePendente: 4, valorUnitario: 50 }),
      linha({ numero: "999", referencia: "C", situacao: "OK" }),
    ]);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ numero: "4502182628", estado: "PARCIAL", saldo: 200 });
    expect(pedidos[0].itens.map((i) => [i.referencia, i.quantidadeFaturada, i.status])).toEqual([
      ["A", 10, "OK"],
      ["B", 6, "PENDENTE"],
    ]);
  });

  it("pedido sem nada faturado fica sem nota", () => {
    const [p] = pedidosEmAberto([linha({ situacao: "PENDENTE", quantidadePendente: 10 })]);
    expect(p.estado).toBe("SEM_NFE");
    expect(p.saldo).toBe(1000);
  });

  it("S/NUMERO agrupa por cliente e mês", () => {
    const pedidos = pedidosEmAberto([
      linha({ numero: null, dataPedido: d("2026-08-01"), situacao: "PENDENTE", quantidadePendente: 1 }),
      linha({ numero: null, dataPedido: d("2026-08-01"), referencia: "X", situacao: "PENDENTE", quantidadePendente: 1 }),
      linha({ numero: null, dataPedido: d("2026-09-01"), situacao: "PENDENTE", quantidadePendente: 1 }),
    ]);
    expect(pedidos.map((p) => p.itens.length)).toEqual([2, 1]);
  });

  it("usa a data mais antiga do pedido", () => {
    const [p] = pedidosEmAberto([
      linha({ dataPedido: d("2023-05-09"), situacao: "PENDENTE", quantidadePendente: 1 }),
      linha({ dataPedido: d("2023-05-01"), referencia: "Z" }),
    ]);
    expect(p.dataPedido).toEqual(d("2023-05-01"));
  });
});

describe("lerLinhasAcompanhamento", () => {
  it("acha o cabeçalho abaixo do título e ignora linhas incompletas", () => {
    const grade: unknown[][] = [
      ["BOWDEN - ACOMPANHAMENTO - COMPACTADA"],
      ["PEDIDO", "PEDIDO"],
      ["CNPJ", "FANTASIA", "MÊS/ANO PEDIDO", "Nº PEDIDO", "REF", "QNT PEDIDO", "QNT PENDENTE", "VR UNT PENDENTE", "VR TOTAL PEND", "SITUAÇÃO", "NFE"],
      [7965809003201, "FILIAL-31", d("2023-05-31"), 4502203799, 40150688, 3, 1, 318.42, 318.42, "PENDENTE", ""],
      [null, "", null, "", "", "", "", "", "", "", ""],
      [7965809003201, "FILIAL-31", d("2023-05-31"), 4502203799, "", 3, 0, 1, 0, "OK", ""],
    ];
    const { linhas, ignoradas } = lerLinhasAcompanhamento(grade);
    expect(ignoradas).toBe(1);
    expect(linhas).toEqual([
      {
        cnpj: "07965809003201",
        fantasia: "FILIAL-31",
        dataPedido: d("2023-05-31"),
        numero: "4502203799",
        referencia: "40150688",
        quantidadePedida: 3,
        quantidadePendente: 1,
        valorUnitario: 318.42,
        situacao: "PENDENTE",
      },
    ]);
  });

  it("recusa planilha sem as colunas", () => {
    expect(() => lerLinhasAcompanhamento([["A", "B"]])).toThrow(/cabeçalho/);
  });
});
