// Linha do tempo da ficha da empresa: categoria para o filtro, autoria e agrupamento por dia.
import { formatarDiaComSemana, somarDias } from "./prazo";

export type CategoriaEvento = "conversa" | "anotacao" | "pedido";

const ANOTACOES = new Set(["OUTRO", "PESQUISA"]);

/** WhatsApp, ligação, e-mail, visita e reunião são conversa; o resto é anotação. */
export function categoriaDoCanal(canal: string): Exclude<CategoriaEvento, "pedido"> {
  return ANOTACOES.has(canal) ? "anotacao" : "conversa";
}

/** "Hoje", "Ontem" ou "Segunda, 12/10/2026". `dia` e `hoje` são "AAAA-MM-DD". */
export function rotuloDoDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(hoje, -1)) return "Ontem";
  const texto = formatarDiaComSemana(dia);
  return texto[0].toUpperCase() + texto.slice(1);
}

/** Quem registrou. O que veio do Claude leva a marca, com o nome de quem conversava com ele. */
export function autoria(origem: string, nomeUsuario: string | null): { quem: string; peloClaude: boolean } {
  if (origem === "CLAUDE") return { quem: nomeUsuario ?? "Claude", peloClaude: true };
  if (origem === "AUTOMACAO") return { quem: "Automação", peloClaude: false };
  if (origem === "IMPORTACAO") return { quem: "Importação", peloClaude: false };
  return { quem: nomeUsuario ?? "—", peloClaude: false };
}

/** Do dia mais recente para o mais antigo; dentro do dia, do mais recente para o mais antigo. */
export function agruparPorDia<T extends { dia: string; quando: number }>(eventos: T[]): { dia: string; eventos: T[] }[] {
  const ordenados = [...eventos].sort((a, b) => b.quando - a.quando);
  const grupos: { dia: string; eventos: T[] }[] = [];
  for (const e of ordenados) {
    const atual = grupos[grupos.length - 1];
    if (atual?.dia === e.dia) atual.eventos.push(e);
    else grupos.push({ dia: e.dia, eventos: [e] });
  }
  return grupos.sort((a, b) => b.dia.localeCompare(a.dia));
}
