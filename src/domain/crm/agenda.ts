import { somarDias } from "./prazo";

// A agenda do dia (rotina "hoje" do Rômulo): o que está atrasado, o que vence hoje, a semana e o resto.

export type Agenda<T> = { atrasados: T[]; hoje: T[]; proximos7: T[]; depois: T[] };

export function separarAgenda<T extends { prazo: string }>(passos: T[], hoje: string): Agenda<T> {
  const limite = somarDias(hoje, 7);
  const ordenados = [...passos].sort((a, b) => a.prazo.localeCompare(b.prazo));
  return {
    atrasados: ordenados.filter((p) => p.prazo < hoje),
    hoje: ordenados.filter((p) => p.prazo === hoje),
    proximos7: ordenados.filter((p) => p.prazo > hoje && p.prazo <= limite),
    depois: ordenados.filter((p) => p.prazo > limite),
  };
}
