import { diasSemNota, pedidosSemNfeVencidos, type PedidoParaAlerta } from "./semNfe";
import { DIAS_NOTA_PARADA, emTransito } from "@/domain/rastreio/parada";

/**
 * A fila de alertas da operação: tudo o que pede uma ação do Zé hoje, numa lista só.
 * O painel inicial mostra o topo dela; a tela de alertas mostra tudo, separado por tipo.
 */

/** Dias até um pedido rápido sem itens virar lembrete de pedir o PDF ao cliente. */
export const DIAS_RAPIDO_SEM_ITENS = 3;

export type TipoAlerta = "CHAMADO_CRITICO" | "SEM_NOTA" | "NOTA_PARADA" | "SEM_RASTREIO" | "RAPIDO_SEM_ITENS";

export const TIPOS_ALERTA: TipoAlerta[] = ["SEM_NOTA", "NOTA_PARADA", "SEM_RASTREIO", "RAPIDO_SEM_ITENS", "CHAMADO_CRITICO"];

export const ROTULO_ALERTA: Record<TipoAlerta, { titulo: string; acao: string }> = {
  SEM_NOTA: { titulo: "Pedidos sem nota", acao: "Cobrar a fábrica" },
  NOTA_PARADA: { titulo: "Notas paradas", acao: "Ligar para a transportadora" },
  SEM_RASTREIO: { titulo: "Notas sem rastreio automático", acao: "Consultar a transportadora e atualizar à mão" },
  RAPIDO_SEM_ITENS: { titulo: "Pedidos sem itens", acao: "Pedir o PDF do pedido ao cliente" },
  CHAMADO_CRITICO: { titulo: "Chamados críticos", acao: "Resolver a divergência" },
};

export type Alerta = {
  chave: string;
  tipo: TipoAlerta;
  titulo: string;
  detalhe: string;
  href: string;
  dias: number;
  valor: number | null;
};

export type NotaParaAlerta = {
  id: string;
  numero: string;
  cliente: string;
  status: string;
  dataEmissao: Date;
  totalNota: number;
  ultimaOcorrencia: string | null;
  ultimaOcorrenciaEm: Date | null;
  transportadora: { nome: string; metodo: string } | null;
};

export type ChamadoParaAlerta = { id: string; numeroNota: string; motivo: string; estado: string; criadoEm: Date };

const MS_POR_DIA = 1000 * 60 * 60 * 24;
const diasEntre = (desde: Date, agora: Date) => Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / MS_POR_DIA));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function montarAlertas(
  entrada: {
    pedidos: PedidoParaAlerta[];
    notas: NotaParaAlerta[];
    chamadosCriticos: ChamadoParaAlerta[];
    prazoPadraoDias: number;
  },
  agora: Date = new Date(),
): Alerta[] {
  const alertas: Alerta[] = [];

  // Pedido sem nota além do prazo da fábrica. Um rápido sem itens nessa situação fica num
  // alerta só, com o lembrete do PDF no detalhe, para não aparecer duas vezes na fila.
  const vencidos = pedidosSemNfeVencidos(entrada.pedidos, agora, entrada.prazoPadraoDias);
  const vencidosIds = new Set(vencidos.map((v) => v.pedidoId));
  for (const v of vencidos) {
    alertas.push({
      chave: `SEM_NOTA-${v.pedidoId}`,
      tipo: "SEM_NOTA",
      titulo: `Pedido ${v.numero} sem nota`,
      detalhe: [v.fabrica, v.cliente, `${plural(v.diasSemNfe, "dia", "dias")} (prazo ${v.prazoDias})`, v.rapidoSemItens ? "sem itens" : null]
        .filter(Boolean)
        .join(" · "),
      href: `/pedidos/${v.pedidoId}`,
      dias: v.diasSemNfe,
      valor: v.valor,
    });
  }

  for (const p of entrada.pedidos) {
    if (!p.rapidoSemItens || p.estado !== "SEM_NFE" || vencidosIds.has(p.id)) continue;
    const dias = diasSemNota(p, agora);
    if (dias < DIAS_RAPIDO_SEM_ITENS) continue;
    alertas.push({
      chave: `RAPIDO_SEM_ITENS-${p.id}`,
      tipo: "RAPIDO_SEM_ITENS",
      titulo: `Pedido ${p.numero} sem itens`,
      detalhe: `${p.fabrica} · ${p.cliente} · registrado há ${plural(dias, "dia", "dias")}`,
      href: `/pedidos/${p.id}`,
      dias,
      valor: p.saldo ?? null,
    });
  }

  // Nota em trânsito sem novidade há DIAS_NOTA_PARADA dias. Se o sistema não consegue
  // consultar a transportadora, o alerta diz isso, porque a ação é outra: perguntar à mão.
  for (const n of entrada.notas) {
    if (!emTransito(n.status)) continue;
    const dias = diasEntre(n.ultimaOcorrenciaEm ?? n.dataEmissao, agora);
    if (dias < DIAS_NOTA_PARADA) continue;
    const automatico = n.transportadora?.metodo === "SSW";
    const transportadora = n.transportadora?.nome ?? "transportadora não identificada";
    alertas.push({
      chave: `${automatico ? "NOTA_PARADA" : "SEM_RASTREIO"}-${n.id}`,
      tipo: automatico ? "NOTA_PARADA" : "SEM_RASTREIO",
      titulo: `Nota ${n.numero} ${automatico ? "parada" : "sem notícia"}`,
      detalhe: [
        n.cliente,
        transportadora,
        automatico && n.ultimaOcorrencia ? `${n.ultimaOcorrencia} há ${plural(dias, "dia", "dias")}` : `${plural(dias, "dia", "dias")} sem atualização`,
      ].join(" · "),
      href: `/rastreio/${n.id}`,
      dias,
      valor: n.totalNota,
    });
  }

  for (const c of entrada.chamadosCriticos) {
    alertas.push({
      chave: `CHAMADO_CRITICO-${c.id}`,
      tipo: "CHAMADO_CRITICO",
      titulo: `Chamado crítico da nota ${c.numeroNota}`,
      detalhe: `${c.motivo} · ${c.estado === "ABERTO" ? "aberto" : "em andamento"} há ${plural(diasEntre(c.criadoEm, agora), "dia", "dias")}`,
      href: `/divergencias/${c.id}`,
      dias: diasEntre(c.criadoEm, agora),
      valor: null,
    });
  }

  // Chamado crítico primeiro (já passou do prazo de resolução); depois, o mais velho.
  return alertas.sort((a, b) => {
    const criticoA = a.tipo === "CHAMADO_CRITICO" ? 1 : 0;
    const criticoB = b.tipo === "CHAMADO_CRITICO" ? 1 : 0;
    return criticoB - criticoA || b.dias - a.dias;
  });
}

export function contarAlertas(alertas: Alerta[]): Record<TipoAlerta, number> {
  const contagem = Object.fromEntries(TIPOS_ALERTA.map((t) => [t, 0])) as Record<TipoAlerta, number>;
  for (const a of alertas) contagem[a.tipo]++;
  return contagem;
}
