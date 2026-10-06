// Funil da carteira (ADR-013): o card é uma oportunidade = um cliente + uma fábrica.
// Funções puras; a server action e a tela usam as mesmas regras.
import { errosDoProximoPasso, erroDeData, type DadosMovimento } from "./funil";

export type EtapaOportunidade = "A_ABORDAR" | "ABORDADO" | "INTERESSE" | "COTACAO" | "GANHA" | "ADIADA" | "PERDIDA";
export type TipoOportunidade = "VENDER_FABRICA_NOVA" | "REATIVAR";

export const ETAPAS_ATIVAS_OP = ["ABORDADO", "INTERESSE", "COTACAO"] as const;
export const ETAPAS_DO_QUADRO_OP = ["A_ABORDAR", ...ETAPAS_ATIVAS_OP] as const;
export const ETAPAS_FORA_DO_QUADRO_OP = ["GANHA", "ADIADA", "PERDIDA"] as const;

export const ROTULO_ETAPA_OP: Record<EtapaOportunidade, string> = {
  A_ABORDAR: "A abordar",
  ABORDADO: "Abordado",
  INTERESSE: "Com interesse",
  COTACAO: "Cotação",
  GANHA: "Ganha",
  ADIADA: "Adiada",
  PERDIDA: "Perdida",
};

export const ROTULO_TIPO_OP: Record<TipoOportunidade, string> = {
  VENDER_FABRICA_NOVA: "Vender fábrica nova",
  REATIVAR: "Reativar",
};

export const etapaAtivaOp = (etapa: string) => (ETAPAS_ATIVAS_OP as readonly string[]).includes(etapa);
export const oportunidadeAberta = (etapa: string) => etapa !== "GANHA" && etapa !== "PERDIDA";

export function validarMovimentoOportunidade(de: string, para: string, dados: DadosMovimento, hoje: string): string[] {
  if (de === para) return ["A oportunidade já está nesta etapa."];
  if (de === "GANHA") return ["Oportunidade ganha não volta para o funil. Crie outra, se for o caso."];
  if (para === "GANHA") return ["A oportunidade fica ganha sozinha, quando chega o pedido desse cliente nessa fábrica."];
  const permitidas: string[] = [...ETAPAS_DO_QUADRO_OP, "ADIADA", "PERDIDA"];
  if (!permitidas.includes(para)) return ["Etapa desconhecida."];

  const erros: string[] = [];
  if (etapaAtivaOp(para)) erros.push(...errosDoProximoPasso(dados.proximoPasso, hoje));
  if (para === "ADIADA") {
    const erroData = erroDeData(dados.retomadaEm, hoje);
    if (erroData) erros.push(`Retomada: ${erroData.toLowerCase()}`);
  }
  if (para === "PERDIDA" && !dados.motivo?.trim()) erros.push("Diga o motivo da perda.");
  return erros;
}

export function resumoDoMovimentoOportunidade(
  fabrica: string,
  de: string,
  para: string,
  dados: DadosMovimento,
  automatico = false,
): string {
  const r = (e: string) => ROTULO_ETAPA_OP[e as EtapaOportunidade] ?? e;
  const base = `${fabrica}: ${r(de)} → ${r(para)}${automatico ? " (movido automaticamente)" : ""}.`;
  if (para === "PERDIDA" && dados.motivo) return `${base} Motivo: ${dados.motivo.trim()}.`;
  return base;
}

export type ClienteParaSugestao = { id: string; nome: string; fabricaIds: string[]; valorHistorico: number };

export type Sugestao = { clienteId: string; cliente: string; fabricaId: string; fabrica: string; compra: string[] };

// "FILIAL-xx" é uma rede ainda não identificada (CLAUDE.md da pasta rep, regra 8): não vira
// sugestão enquanto o Rômulo não disser quem são.
const REDE_NAO_IDENTIFICADA = /^FILIAL-/i;

/**
 * Expansão: fábricas que o cliente ainda não compra. É um fato do cadastro (cliente × fábrica),
 * não uma previsão: nada de inferir recompra ou churn só da planilha. Quem comprou mais
 * (histórico recebido, sem linhas duplicadas) vem primeiro.
 */
export function sugerirExpansao(
  clientes: ClienteParaSugestao[],
  fabricas: { id: string; nome: string }[],
  abertas: Set<string>,
  limite = 8,
): Sugestao[] {
  const nomeFabrica = new Map(fabricas.map((f) => [f.id, f.nome]));
  const sugestoes: (Sugestao & { valor: number })[] = [];
  for (const c of clientes) {
    if (REDE_NAO_IDENTIFICADA.test(c.nome) || c.fabricaIds.length === 0) continue;
    const compra = c.fabricaIds.map((id) => nomeFabrica.get(id)).filter((n): n is string => !!n).sort();
    for (const f of fabricas) {
      if (c.fabricaIds.includes(f.id) || abertas.has(`${c.id}|${f.id}`)) continue;
      sugestoes.push({ clienteId: c.id, cliente: c.nome, fabricaId: f.id, fabrica: f.nome, compra, valor: c.valorHistorico });
    }
  }
  return sugestoes
    .sort((a, b) => b.valor - a.valor || a.cliente.localeCompare(b.cliente) || a.fabrica.localeCompare(b.fabrica))
    .slice(0, limite)
    .map((s) => ({ clienteId: s.clienteId, cliente: s.cliente, fabricaId: s.fabricaId, fabrica: s.fabrica, compra: s.compra }));
}
