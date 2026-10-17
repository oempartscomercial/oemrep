import { prisma } from "@/lib/prisma";
import { montarWhereEmpresas } from "@/lib/crm/busca";
import { ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";
import { acharFabricaPorNome } from "@/domain/crm/fabrica-prospeccao";
import { listarFabricasAtivas } from "@/lib/crm/fabricas-prospeccao";

// O Claude fala o nome ("a Dispetral"), não o id. Aqui o nome vira uma empresa ou um usuário,
// ou uma pergunta de volta quando há mais de um candidato. Nunca se escolhe no chute.

export type Resolvido<T> = { ok: true; valor: T } | { ok: false; mensagem: string };

const chave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const ID = /^c[a-z0-9]{20,}$/;

export const localDa = (c: { cidade: string | null; uf: string | null }) => [c.cidade, c.uf].filter(Boolean).join("/");
export const rotuloSituacao = (s: string) => ROTULO_SITUACAO[s as Situacao] ?? s;
export const nomeComLocal = (c: { nomeFantasia: string; cidade: string | null; uf: string | null }) => {
  const l = localDa(c);
  return l ? `${c.nomeFantasia} (${l})` : c.nomeFantasia;
};

type EmpresaResolvida = { id: string; nomeFantasia: string; cidade: string | null; uf: string | null; situacao: string };

/** Id, nome, CNPJ, site ou cidade → uma empresa só. */
export async function resolverEmpresa(texto: string): Promise<Resolvido<EmpresaResolvida>> {
  const termo = texto.trim();
  if (!termo) return { ok: false, mensagem: "Diga qual é a empresa (nome, CNPJ ou site)." };
  const select = { id: true, nomeFantasia: true, cidade: true, uf: true, situacao: true } as const;
  if (ID.test(termo)) {
    const porId = await prisma.cliente.findUnique({ where: { id: termo }, select });
    if (porId) return { ok: true, valor: porId };
  }
  const achadas = await prisma.cliente.findMany({ where: montarWhereEmpresas("todas", termo), orderBy: { nomeFantasia: "asc" }, take: 10, select });
  if (achadas.length === 1) return { ok: true, valor: achadas[0] };
  const identicas = achadas.filter((e) => chave(e.nomeFantasia) === chave(termo));
  if (identicas.length === 1) return { ok: true, valor: identicas[0] };
  if (achadas.length === 0) {
    return { ok: false, mensagem: `Nenhuma empresa encontrada para "${termo}". Confirme o nome com o usuário ou, se for empresa nova de prospecção, cadastre com nova_empresa.` };
  }
  const lista = achadas.map((e) => `- ${nomeComLocal(e)} [${rotuloSituacao(e.situacao)}] · id: ${e.id}`).join("\n");
  return { ok: false, mensagem: `Mais de uma empresa para "${termo}". Pergunte qual é e repita usando o id:\n${lista}` };
}

/** Nome de quem fica responsável → usuário que pode receber tarefa do CRM. Vazio = quem está falando. */
export async function resolverResponsavel(texto: string | null | undefined, padraoId: string): Promise<Resolvido<{ id: string; nome: string }>> {
  const candidatos = await prisma.usuario.findMany({ where: { ativo: true, perfil: { not: "OPERADOR" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const termo = chave(texto ?? "");
  if (!termo) {
    const padrao = candidatos.find((u) => u.id === padraoId);
    return padrao ? { ok: true, valor: padrao } : { ok: false, mensagem: "Você não pode receber tarefas do CRM. Diga quem fica responsável." };
  }
  const exatos = candidatos.filter((u) => chave(u.nome) === termo || chave(u.nome).split(" ")[0] === termo);
  const achados = exatos.length > 0 ? exatos : candidatos.filter((u) => chave(u.nome).includes(termo));
  if (achados.length === 1) return { ok: true, valor: achados[0] };
  const nomes = candidatos.map((u) => u.nome).join(", ");
  return achados.length === 0
    ? { ok: false, mensagem: `Ninguém chamado "${texto}" pode receber tarefas do CRM. Quem pode: ${nomes}.` }
    : { ok: false, mensagem: `Mais de uma pessoa para "${texto}": ${achados.map((u) => u.nome).join(", ")}. Diga o nome completo.` };
}

/** Nomes de fábrica falados ("rudolph", "h3") → fábricas ativas. Qualquer nome que não casa devolve a pergunta. */
export async function resolverFabricas(nomes: string[] | undefined): Promise<Resolvido<{ id: string; nome: string }[]>> {
  const pedidos = (nomes ?? []).filter((n) => n.trim());
  if (pedidos.length === 0) return { ok: true, valor: [] };
  const ativas = await listarFabricasAtivas();
  const achadas: { id: string; nome: string }[] = [];
  for (const nome of pedidos) {
    const r = acharFabricaPorNome(nome, ativas);
    if (!r.ok) return r;
    if (!achadas.some((f) => f.id === r.valor.id)) achadas.push(r.valor);
  }
  return { ok: true, valor: achadas };
}
