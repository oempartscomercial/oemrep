import { prisma } from "@/lib/prisma";
import { FALHAS_PARA_DESISTIR_DO_SSW } from "./atualizar";

/**
 * Transportadora nova que o sistema não conseguiu rastrear sozinho vira uma issue no GitHub
 * (uma por CNPJ). Uma rotina do Claude lê as issues com a label `transportadora`, descobre
 * como rastrear e abre o PR com o adaptador. Sem GITHUB_TOKEN, não faz nada.
 */
export const LABEL_TRANSPORTADORA = "transportadora";

type Issue = { html_url: string; title: string };

function repo(): string {
  return process.env.GITHUB_REPO || "arthur7114/oem-rep";
}

async function github<T>(caminho: string, token: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`https://api.github.com${caminho}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} em ${caminho}`);
  return (await r.json()) as T;
}

export function tituloDaIssue(t: { nome: string; cnpj: string }): string {
  return `[transportadora] Rastreio automático: ${t.nome} (${t.cnpj})`;
}

export function corpoDaIssue(
  t: { nome: string; cnpj: string; falhasSeguidas: number },
  exemplo: { numero: string; chaveAcesso: string } | null,
  emTransito: number,
): string {
  return [
    `A transportadora **${t.nome}** (CNPJ \`${t.cnpj}\`) apareceu em notas da OEM e o sistema não conseguiu rastrear sozinho.`,
    "",
    `- Notas em trânsito com ela agora: **${emTransito}**`,
    `- Tentativas no SSW (\`POST https://ssw.inf.br/api/trackingdanfe\`) sem resultado: ${t.falhasSeguidas}`,
    exemplo ? `- Nota de exemplo: NF ${exemplo.numero}, chave \`${exemplo.chaveAcesso}\`` : "- Sem nota de exemplo em trânsito.",
    "",
    "## O que fazer",
    "1. Achar o site da transportadora pelo CNPJ e ver como ela rastreia (SSW com outro domínio, ESL Cloud, Brudam, site próprio, só telefone).",
    "2. Se tiver consulta pública por chave/NF/CNPJ: criar o adaptador em `src/lib/rastreio/` no mesmo formato de `ssw.ts` (devolve `ResultadoConsulta`), com teste usando resposta anonimizada.",
    "3. Ligar o adaptador em `atualizarRastreioDaNota` (novo valor em `MetodoRastreio`, migração) e testar com a chave de exemplo.",
    "4. Se não houver rastreio público: marcar a transportadora como `MANUAL` em Cadastros → Transportadoras, com o contato, e fechar a issue explicando.",
    "",
    "_Aberta automaticamente pelo cron de rastreio._",
  ].join("\n");
}

/** Abre (ou reaproveita) a issue de cada transportadora não mapeada que já desistiu do SSW. */
export async function abrirIssuesDeTransportadorasNovas(): Promise<{ abertas: number; reaproveitadas: number; pulou?: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { abertas: 0, reaproveitadas: 0, pulou: "GITHUB_TOKEN não configurado" };

  const pendentes = await prisma.transportadora.findMany({
    where: { metodo: "NAO_MAPEADA", issueUrl: null, falhasSeguidas: { gte: FALHAS_PARA_DESISTIR_DO_SSW } },
  });
  if (pendentes.length === 0) return { abertas: 0, reaproveitadas: 0 };

  const existentes = await github<Issue[]>(`/repos/${repo()}/issues?labels=${LABEL_TRANSPORTADORA}&state=all&per_page=100`, token);
  let abertas = 0;
  let reaproveitadas = 0;
  for (const t of pendentes) {
    const ja = existentes.find((i) => i.title.includes(t.cnpj));
    if (ja) {
      await prisma.transportadora.update({ where: { id: t.id }, data: { issueUrl: ja.html_url } });
      reaproveitadas++;
      continue;
    }
    const [exemplo, emTransito] = await Promise.all([
      prisma.notaFiscal.findFirst({ where: { transportadoraId: t.id, status: { in: ["TRANSITO", "AGENDADO"] } }, select: { numero: true, chaveAcesso: true }, orderBy: { criadoEm: "desc" } }),
      prisma.notaFiscal.count({ where: { transportadoraId: t.id, status: { in: ["TRANSITO", "AGENDADO"] } } }),
    ]);
    const issue = await github<Issue>(`/repos/${repo()}/issues`, token, {
      method: "POST",
      body: JSON.stringify({ title: tituloDaIssue(t), body: corpoDaIssue(t, exemplo, emTransito), labels: [LABEL_TRANSPORTADORA] }),
    });
    await prisma.transportadora.update({ where: { id: t.id }, data: { issueUrl: issue.html_url } });
    abertas++;
  }
  return { abertas, reaproveitadas };
}
