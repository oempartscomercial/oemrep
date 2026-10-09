import { describe, it, expect } from "vitest";
import { contarAlertas, montarAlertas, type NotaParaAlerta } from "../fila";
import type { PedidoParaAlerta } from "../semNfe";

const agora = new Date("2026-10-09T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000);

const pedido = (p: Partial<PedidoParaAlerta> & { id: string }): PedidoParaAlerta => ({
  numero: p.id.toUpperCase(),
  fabrica: "Autoflex",
  cliente: "Padre Cícero",
  estado: "SEM_NFE",
  criadoEm: diasAtras(1),
  saldo: 1000,
  ...p,
});

const nota = (n: Partial<NotaParaAlerta> & { id: string }): NotaParaAlerta => ({
  numero: n.id,
  cliente: "Impel",
  status: "TRANSITO",
  dataEmissao: diasAtras(10),
  totalNota: 5000,
  ultimaOcorrencia: null,
  ultimaOcorrenciaEm: null,
  transportadora: { nome: "Transuni", metodo: "SSW" },
  ...n,
});

const montar = (entrada: { pedidos?: PedidoParaAlerta[]; notas?: NotaParaAlerta[]; chamados?: Parameters<typeof montarAlertas>[0]["chamadosCriticos"] }) =>
  montarAlertas({ pedidos: entrada.pedidos ?? [], notas: entrada.notas ?? [], chamadosCriticos: entrada.chamados ?? [], prazoPadraoDias: 7 }, agora);

describe("montarAlertas", () => {
  it("pedido sem nota além do prazo vira alerta com o valor que falta faturar", () => {
    const [a] = montar({ pedidos: [pedido({ id: "p1", criadoEm: diasAtras(9), saldo: 2500 })] });
    expect(a).toMatchObject({ tipo: "SEM_NOTA", href: "/pedidos/p1", dias: 9, valor: 2500 });
    expect(a.detalhe).toContain("prazo 7");
  });

  it("pedido rápido sem itens dentro do prazo vira lembrete de pedir o PDF depois de 3 dias", () => {
    const alertas = montar({
      pedidos: [
        pedido({ id: "novo", rapidoSemItens: true, criadoEm: diasAtras(2) }),
        pedido({ id: "velho", rapidoSemItens: true, criadoEm: diasAtras(4) }),
      ],
    });
    expect(alertas.map((a) => [a.tipo, a.chave])).toEqual([["RAPIDO_SEM_ITENS", "RAPIDO_SEM_ITENS-velho"]]);
  });

  it("pedido rápido sem itens e fora do prazo aparece uma vez só, como sem nota", () => {
    const alertas = montar({ pedidos: [pedido({ id: "p1", rapidoSemItens: true, criadoEm: diasAtras(10) })] });
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ tipo: "SEM_NOTA" });
    expect(alertas[0].detalhe).toContain("sem itens");
  });

  it("nota consultada pelo sistema e sem novidade há 5 dias é nota parada", () => {
    const alertas = montar({
      notas: [
        nota({ id: "parada", ultimaOcorrencia: "Em trânsito", ultimaOcorrenciaEm: diasAtras(6) }),
        nota({ id: "andando", ultimaOcorrencia: "Em trânsito", ultimaOcorrenciaEm: diasAtras(1) }),
      ],
    });
    expect(alertas.map((a) => a.chave)).toEqual(["NOTA_PARADA-parada"]);
    expect(alertas[0].detalhe).toContain("Em trânsito há 6 dias");
  });

  it("nota de transportadora sem integração vira alerta de consultar à mão, não de nota parada", () => {
    const alertas = montar({
      notas: [
        nota({ id: "manual", transportadora: { nome: "Newlog", metodo: "MANUAL" } }),
        nota({ id: "sem-transportadora", transportadora: null }),
      ],
    });
    expect(alertas.map((a) => a.tipo)).toEqual(["SEM_RASTREIO", "SEM_RASTREIO"]);
    expect(alertas.find((a) => a.chave === "SEM_RASTREIO-sem-transportadora")?.detalhe).toContain("transportadora não identificada");
  });

  it("nota entregue não é alerta", () => {
    expect(montar({ notas: [nota({ id: "ok", status: "RECEBIDA" })] })).toEqual([]);
  });

  it("chamado crítico vem primeiro; o resto, do mais velho para o mais novo", () => {
    const alertas = montar({
      pedidos: [pedido({ id: "p1", criadoEm: diasAtras(30) })],
      notas: [nota({ id: "n1", ultimaOcorrenciaEm: diasAtras(8), ultimaOcorrencia: "Coleta" })],
      chamados: [{ id: "c1", numeroNota: "4145", motivo: "Falta", estado: "ABERTO", criadoEm: diasAtras(2) }],
    });
    expect(alertas.map((a) => a.tipo)).toEqual(["CHAMADO_CRITICO", "SEM_NOTA", "NOTA_PARADA"]);
    expect(contarAlertas(alertas)).toMatchObject({ CHAMADO_CRITICO: 1, SEM_NOTA: 1, NOTA_PARADA: 1, SEM_RASTREIO: 0, RAPIDO_SEM_ITENS: 0 });
  });
});
