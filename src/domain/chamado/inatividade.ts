const MS_POR_DIA = 1000 * 60 * 60 * 24;

// ADR-006: chamado crítico por inatividade após 30 dias sem novo evento (padrão único
// e global, configurável via Parametro "prazo_chamado_critico_dias").
export function estaCritico(dataUltimoEvento: Date, hoje: Date, prazoDias: number = 30): boolean {
  const diasSemEvento = (hoje.getTime() - dataUltimoEvento.getTime()) / MS_POR_DIA;
  return diasSemEvento >= prazoDias;
}
