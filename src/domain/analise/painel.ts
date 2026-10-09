/**
 * Números do painel inicial por fábrica: quanto falta a fábrica faturar, quanto chegou de
 * pedido no mês e quanto saiu de nota no mês. O mês é o de São Paulo, não o do servidor.
 */

export type FabricaPainel = { id: string; nome: string };
export type PedidoPainel = { fabricaId: string; estado: string; dataRef: Date; valor: number; saldo: number };
export type NotaPainel = { fabricaId: string | null; dataEmissao: Date; totalNota: number };

export type ResumoFabrica = {
  id: string;
  nome: string;
  aFaturar: number;
  pedidosAbertos: number;
  recebidoMes: number;
  pedidosMes: number;
  faturadoMes: number;
  notasMes: number;
};

const centavos = (v: number) => Math.round(v * 100) / 100;

/** "2026-10" no fuso de São Paulo. */
export function mesEmSaoPaulo(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

export function resumirPorFabrica(
  fabricas: FabricaPainel[],
  pedidos: PedidoPainel[],
  notas: NotaPainel[],
  agora: Date = new Date(),
): ResumoFabrica[] {
  const mes = mesEmSaoPaulo(agora);
  const resumo = new Map<string, ResumoFabrica>(
    fabricas.map((f) => [f.id, { id: f.id, nome: f.nome, aFaturar: 0, pedidosAbertos: 0, recebidoMes: 0, pedidosMes: 0, faturadoMes: 0, notasMes: 0 }]),
  );

  for (const p of pedidos) {
    const r = resumo.get(p.fabricaId);
    if (!r) continue;
    if (p.saldo > 0) {
      r.aFaturar += p.saldo;
      r.pedidosAbertos++;
    }
    if (mesEmSaoPaulo(p.dataRef) === mes) {
      r.recebidoMes += p.valor;
      r.pedidosMes++;
    }
  }

  for (const n of notas) {
    const r = n.fabricaId ? resumo.get(n.fabricaId) : undefined;
    if (!r || mesEmSaoPaulo(n.dataEmissao) !== mes) continue;
    r.faturadoMes += n.totalNota;
    r.notasMes++;
  }

  return [...resumo.values()]
    .map((r) => ({ ...r, aFaturar: centavos(r.aFaturar), recebidoMes: centavos(r.recebidoMes), faturadoMes: centavos(r.faturadoMes) }))
    .sort((a, b) => b.aFaturar - a.aFaturar || b.recebidoMes - a.recebidoMes || a.nome.localeCompare(b.nome, "pt-BR"));
}
