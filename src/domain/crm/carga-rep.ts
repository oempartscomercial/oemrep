import type { CanalContato } from "./importacao-rep";
import { cnpjValido } from "@/domain/cadastro/cnpj";

/**
 * Regras da carga da pasta do Rômulo (rep/dados) para produção. Diferente do seed local,
 * a carga casa com o que já existe (clientes vindos das planilhas do Zé, pelo CNPJ) e
 * pode rodar de novo sem duplicar.
 */

export type OrigemContato = "PUBLICADO_PELA_EMPRESA" | "INDICACAO" | "BASE_PROFISSIONAL" | "RELACIONAMENTO";

const CANAIS_DE_MENSAGEM: CanalContato[] = ["WHATSAPP", "TELEFONE", "EMAIL"];

/**
 * De onde veio o número (ADR-015 §4). Só é "publicado pela empresa" o canal de mensagem
 * cuja fonte é uma página da própria empresa. LinkedIn, cadastro da Receita e contato marcado
 * "não usar" ficam sem origem, e por isso nenhuma mensagem sai para eles.
 */
export function origemDoContato(c: { canal: CanalContato; fonte: string; status: string | null }): OrigemContato | null {
  if (!CANAIS_DE_MENSAGEM.includes(c.canal)) return null;
  if (c.status && /^n[ãa]o\b/i.test(c.status.trim())) return null;
  const fonte = c.fonte.trim().toLowerCase();
  if (!/^https?:\/\//.test(fonte)) return null;
  if (/linkedin\.|brasilapi\.|receita|cnpj\.|econodata|casadosdados/.test(fonte)) return null;
  return "PUBLICADO_PELA_EMPRESA";
}

/** O CSV usa "pessoa" para gente sem canal próprio (sócio da Receita, por exemplo). */
export function canalDaLinha(canal: string): string {
  return canal.trim().toLowerCase() === "pessoa" ? "outro" : canal;
}

/** Chave para casar o rótulo da planilha de pedidos com o nome das planilhas do Zé. */
export function chaveDeNome(nome: string): string {
  return nome
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** "AUTOFLEX - COMPACTADA.xlsx" → nome da fábrica no sistema. */
export function fabricaDoArquivo(arquivo: string): string | null {
  const a = arquivo.toUpperCase();
  if (a.startsWith("AUTOFLEX")) return "Autoflex";
  if (a.startsWith("BOWDEN")) return "Bowden";
  if (a.startsWith("RUDOLPH")) return "Rudolph";
  if (a.startsWith("SEINECA")) return "Seineca/H3";
  if (a.startsWith("BENDIX")) return "Bendix";
  if (a.startsWith("CORVEN")) return "Corven";
  return null;
}

/** `nomes` vem do mais frequente para o menos; `linhas` conta em quantas linhas cada nome aparece. */
export type ClienteDaPlanilha = { cnpj: string; nomes: string[]; fabricas: string[]; linhas?: Record<string, number> };

const linhasDe = (c: ClienteDaPlanilha, nome: string) => c.linhas?.[nome] ?? 1;

/**
 * Para cada rótulo de cliente (como o Rômulo e o Zé escrevem), o CNPJ das planilhas. As planilhas
 * têm erro de digitação (o mesmo rótulo em poucas linhas de outro CNPJ), então vale o CNPJ em que
 * o rótulo aparece em mais linhas. Empate fica ambíguo e não é casado.
 */
export function indicePorNome(clientes: ClienteDaPlanilha[]): Map<string, string | "AMBIGUO"> {
  const contagem = new Map<string, Map<string, number>>();
  for (const c of clientes) {
    for (const nome of c.nomes) {
      const k = chaveDeNome(nome);
      if (!k) continue;
      const porCnpj = contagem.get(k) ?? new Map<string, number>();
      porCnpj.set(c.cnpj, (porCnpj.get(c.cnpj) ?? 0) + linhasDe(c, nome));
      contagem.set(k, porCnpj);
    }
  }
  const indice = new Map<string, string | "AMBIGUO">();
  for (const [k, porCnpj] of contagem) {
    const ordem = [...porCnpj].sort((a, b) => b[1] - a[1]);
    indice.set(k, ordem.length > 1 && ordem[0][1] === ordem[1][1] ? "AMBIGUO" : ordem[0][0]);
  }
  return indice;
}

export function cnpjDoRotulo(rotulos: string, indice: Map<string, string | "AMBIGUO">): string | null {
  const achados = new Set<string>();
  for (const r of rotulos.split(/[;|]/)) {
    const v = indice.get(chaveDeNome(r));
    if (v && v !== "AMBIGUO") achados.add(v);
  }
  return achados.size === 1 ? [...achados][0] : null;
}

const NOMES_DA_COLUNA_NOME = ["FANTASIA", "NOME FANTASIA", "NOME FANTANSIA"];

/**
 * Clientes (CNPJ + nome) de uma aba das planilhas de acompanhamento: acha a linha que tem
 * "CNPJ" e a coluna de nome, e conta as linhas abaixo. Abas sem esse cabeçalho e CNPJ com
 * dígito verificador errado (digitação) são ignorados.
 */
export function clientesDaGrade(grade: unknown[][], fabrica: string): ClienteDaPlanilha[] {
  const texto = (v: unknown) => chaveDeNome(String(v ?? ""));
  let cab: { linha: number; cnpj: number; nome: number } | null = null;
  for (let i = 0; i < Math.min(grade.length, 15) && !cab; i++) {
    const t = grade[i].map(texto);
    const cnpj = t.indexOf("CNPJ");
    const nome = t.findIndex((x) => NOMES_DA_COLUNA_NOME.includes(x));
    if (cnpj >= 0 && nome >= 0) cab = { linha: i, cnpj, nome };
  }
  if (!cab) return [];
  const porCnpj = new Map<string, ClienteDaPlanilha>();
  for (const row of grade.slice(cab.linha + 1)) {
    const digitos = String(row[cab.cnpj] ?? "").replace(/\D/g, "");
    const nome = String(row[cab.nome] ?? "").trim();
    if (digitos.length < 11 || digitos.length > 14 || !nome) continue;
    const cnpj = digitos.padStart(14, "0");
    if (!cnpjValido(cnpj)) continue;
    const c = porCnpj.get(cnpj) ?? { cnpj, nomes: [], fabricas: [fabrica], linhas: {} };
    c.linhas![nome] = (c.linhas![nome] ?? 0) + 1;
    porCnpj.set(cnpj, c);
  }
  return [...porCnpj.values()].map(ordenarNomes);
}

function ordenarNomes(c: ClienteDaPlanilha): ClienteDaPlanilha {
  const nomes = Object.keys(c.linhas ?? {}).sort((a, b) => c.linhas![b] - c.linhas![a]);
  return { ...c, nomes: nomes.length ? nomes : c.nomes };
}

/** Junta o mesmo CNPJ visto em várias abas e fábricas, somando as linhas de cada nome. */
export function juntarClientes(listas: ClienteDaPlanilha[][]): ClienteDaPlanilha[] {
  const porCnpj = new Map<string, ClienteDaPlanilha>();
  for (const c of listas.flat()) {
    const atual = porCnpj.get(c.cnpj) ?? { cnpj: c.cnpj, nomes: [], fabricas: [], linhas: {} };
    for (const n of c.nomes) atual.linhas![n] = (atual.linhas![n] ?? 0) + linhasDe(c, n);
    for (const f of c.fabricas) if (!atual.fabricas.includes(f)) atual.fabricas.push(f);
    porCnpj.set(c.cnpj, atual);
  }
  return [...porCnpj.values()].map(ordenarNomes);
}
