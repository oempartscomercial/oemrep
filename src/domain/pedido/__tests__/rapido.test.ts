import { describe, it, expect } from "vitest";
import { validarPedidoRapido, type DadosPedidoRapido } from "../rapido";

const AGORA = new Date("2026-10-09T15:00:00-03:00");
const base: DadosPedidoRapido = {
  fabricaId: "f1",
  clienteId: "c1",
  novoCliente: null,
  valorTotal: "18.611,00",
  dataPedido: "2026-10-08",
  numero: "",
  numeroCliente: "",
  observacao: "",
};

describe("validarPedidoRapido", () => {
  it("aceita o mínimo: fábrica, cliente, valor e data", () => {
    const r = validarPedidoRapido(base, AGORA);
    expect(r.erros).toEqual([]);
    expect(r.valido).toMatchObject({ fabricaId: "f1", clienteId: "c1", novoCliente: null, valorTotal: 18611, numero: null, numeroCliente: null });
    expect(r.valido!.dataPedido.toISOString().slice(0, 10)).toBe("2026-10-08");
  });

  it("lê valor com e sem milhar", () => {
    expect(validarPedidoRapido({ ...base, valorTotal: "18611,5" }, AGORA).valido!.valorTotal).toBe(18611.5);
    expect(validarPedidoRapido({ ...base, valorTotal: "R$ 1.250" }, AGORA).valido!.valorTotal).toBe(1250);
  });

  it("aponta cada campo que falta", () => {
    const r = validarPedidoRapido({ ...base, fabricaId: "", clienteId: "", valorTotal: "", dataPedido: "" }, AGORA);
    expect(r.erros).toEqual(["Escolha a fábrica.", "Escolha o cliente.", "Informe o valor total do pedido.", "Informe a data do pedido."]);
  });

  it("recusa valor zero e data no futuro", () => {
    expect(validarPedidoRapido({ ...base, valorTotal: "0" }, AGORA).erros).toContain("O valor total tem de ser maior que zero.");
    expect(validarPedidoRapido({ ...base, dataPedido: "2026-10-20" }, AGORA).erros).toContain("A data do pedido está no futuro.");
  });

  it("cliente novo: exige nome, CNPJ é opcional mas se vier tem de ser válido", () => {
    const sem = { ...base, clienteId: "" };
    expect(validarPedidoRapido({ ...sem, novoCliente: { nome: "", cnpj: "" } }, AGORA).erros).toContain("Escreva o nome do cliente novo.");
    expect(validarPedidoRapido({ ...sem, novoCliente: { nome: "Ara Auto", cnpj: "11.111.111/1111-11" } }, AGORA).erros[0]).toMatch(/CNPJ/);
    const ok = validarPedidoRapido({ ...sem, novoCliente: { nome: " Ara Auto ", cnpj: "" } }, AGORA);
    expect(ok.valido!.novoCliente).toEqual({ nome: "Ara Auto", cnpj: null });
    expect(ok.valido!.clienteId).toBeNull();
  });

  it("guarda números e observação aparados", () => {
    const r = validarPedidoRapido({ ...base, numero: " 4286 ", numeroCliente: "0.2385", observacao: " print do Patrick " }, AGORA);
    expect(r.valido).toMatchObject({ numero: "4286", numeroCliente: "0.2385", observacao: "print do Patrick" });
  });
});
