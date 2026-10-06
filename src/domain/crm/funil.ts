// Regras do funil de prospecção (outbound), ADR-013. Funções puras: a tela e a
// server action usam as mesmas, e o servidor nunca confia no que a tela mostra.

export const ETAPAS_ATIVAS = ["APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO"] as const;
export const ETAPAS_DO_QUADRO = ["CANDIDATA", ...ETAPAS_ATIVAS] as const;
export const ETAPAS_FORA_DO_QUADRO = ["PAUSADA", "DESCARTADA"] as const;

export type Situacao = "CANDIDATA" | "APROVADA" | "EM_CONTATO" | "CONVERSANDO" | "AVANCO" | "PAUSADA" | "DESCARTADA" | "CLIENTE";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  CANDIDATA: "A avaliar",
  APROVADA: "Aprovada",
  EM_CONTATO: "Em contato",
  CONVERSANDO: "Conversando",
  AVANCO: "Avanço",
  PAUSADA: "Pausada",
  DESCARTADA: "Descartada",
  CLIENTE: "Cliente",
};

export function etapaAtiva(situacao: string): boolean {
  return (ETAPAS_ATIVAS as readonly string[]).includes(situacao);
}

export type DadosMovimento = {
  proximoPasso?: { acao: string; prazo: string; responsavelId: string } | null;
  retomadaEm?: string | null;
  motivo?: string | null;
};

export type Movimento = { de: string; para: string; naoContatar: boolean };

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(valor: string | null | undefined, hoje: string): string | null {
  if (!valor || !DATA.test(valor)) return "Informe a data.";
  if (Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())) return "Data inválida.";
  if (valor < hoje) return "A data não pode estar no passado.";
  return null;
}

/** Próximo passo exigido nas etapas em andamento: ação, data (não passada) e responsável. */
export function errosDoProximoPasso(passo: { acao: string; prazo: string; responsavelId: string } | null | undefined, hoje: string): string[] {
  const erros: string[] = [];
  if (!passo || !passo.acao.trim()) erros.push("Diga qual é o próximo passo.");
  const erroData = dataValida(passo?.prazo, hoje);
  if (erroData) erros.push(`Próximo passo: ${erroData.toLowerCase()}`);
  if (!passo?.responsavelId) erros.push("Escolha quem fica responsável.");
  return erros;
}

export function erroDeData(valor: string | null | undefined, hoje: string): string | null {
  return dataValida(valor, hoje);
}

/** Devolve a lista de erros em português; vazia quando o movimento é permitido. */
export function validarMovimento(mov: Movimento, dados: DadosMovimento, hoje: string): string[] {
  const erros: string[] = [];
  if (mov.de === mov.para) return ["A empresa já está nesta etapa."];
  if (mov.de === "CLIENTE") return ["Cliente não volta para o funil de prospecção."];
  if (mov.para === "CLIENTE") return ["A empresa vira cliente sozinha, quando o primeiro pedido é lançado."];

  const permitidas: string[] = [...ETAPAS_DO_QUADRO, ...ETAPAS_FORA_DO_QUADRO];
  if (!permitidas.includes(mov.para)) return ["Etapa desconhecida."];

  if (mov.naoContatar && (mov.para === "EM_CONTATO" || mov.para === "CONVERSANDO")) {
    return ["Esta empresa está marcada como \"não contatar\"."];
  }

  if (etapaAtiva(mov.para)) erros.push(...errosDoProximoPasso(dados.proximoPasso, hoje));
  if (mov.para === "PAUSADA") {
    const erroData = dataValida(dados.retomadaEm, hoje);
    if (erroData) erros.push(`Retomada: ${erroData.toLowerCase()}`);
  }
  if (mov.para === "DESCARTADA" && !dados.motivo?.trim()) erros.push("Diga o motivo do descarte.");
  return erros;
}

/** Texto da linha do tempo para uma mudança de etapa. */
export function resumoDoMovimento(de: string, para: string, dados: DadosMovimento, automatico = false): string {
  const rotulo = (s: string) => ROTULO_SITUACAO[s as Situacao] ?? s;
  const base = `Etapa: ${rotulo(de)} → ${rotulo(para)}${automatico ? " (movido automaticamente)" : ""}.`;
  if (para === "DESCARTADA" && dados.motivo) return `${base} Motivo: ${dados.motivo.trim()}.`;
  return base;
}

/** Onde cada card deve ficar no quadro. */
export function agruparPorEtapa<T extends { situacao: string }>(empresas: T[]): Record<(typeof ETAPAS_DO_QUADRO)[number], T[]> {
  const grupos = Object.fromEntries(ETAPAS_DO_QUADRO.map((e) => [e, [] as T[]])) as Record<(typeof ETAPAS_DO_QUADRO)[number], T[]>;
  for (const e of empresas) if (e.situacao in grupos) grupos[e.situacao as keyof typeof grupos].push(e);
  return grupos;
}
