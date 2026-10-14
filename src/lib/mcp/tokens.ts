import { prisma } from "@/lib/prisma";
import { podeVerCrm, type PerfilUsuario } from "@/lib/authz";
import type { UsuarioSessao } from "@/lib/sessao";
import { compararCampos } from "@/domain/auditoria/evento";
import { gerarToken, hashDoToken, pareceToken, prefixoDoToken } from "@/domain/mcp/token";

// Tokens de acesso do Claude ao CRM (servidor MCP em /api/mcp). O segredo sai daqui uma vez,
// na criação; o banco guarda o hash. Cada usuário cuida dos seus; ADMIN vê e revoga todos.

const SEM_PERMISSAO = "Você não tem permissão para acessar o CRM.";

export async function criarToken(usuario: UsuarioSessao, nome: string): Promise<{ erros: string[]; token?: string; id?: string }> {
  if (!podeVerCrm(usuario)) return { erros: [SEM_PERMISSAO] };
  const limpo = nome.trim().slice(0, 80);
  if (!limpo) return { erros: ["Dê um nome ao acesso (ex.: Claude do Rômulo)."] };

  const token = gerarToken();
  const criado = await prisma.$transaction(async (tx) => {
    const t = await tx.tokenApi.create({ data: { usuarioId: usuario.id, nome: limpo, prefixo: prefixoDoToken(token), hash: hashDoToken(token) } });
    await tx.eventoAuditoria.createMany({ data: compararCampos("TokenApi", t.id, usuario.id, {}, { nome: t.nome, prefixo: t.prefixo }) });
    return t;
  });
  return { erros: [], token, id: criado.id };
}

export type TokenNaLista = {
  id: string;
  nome: string;
  prefixo: string;
  dono: string;
  meu: boolean;
  criadoEm: Date;
  ultimoUsoEm: Date | null;
  revogadoEm: Date | null;
};

export async function listarTokens(usuario: UsuarioSessao): Promise<TokenNaLista[]> {
  const tokens = await prisma.tokenApi.findMany({
    where: usuario.perfil === "ADMIN" ? {} : { usuarioId: usuario.id },
    orderBy: [{ revogadoEm: { sort: "desc", nulls: "first" } }, { criadoEm: "desc" }],
    select: { id: true, nome: true, prefixo: true, criadoEm: true, ultimoUsoEm: true, revogadoEm: true, usuarioId: true, usuario: { select: { nome: true } } },
  });
  return tokens.map(({ usuario: dono, usuarioId, ...t }) => ({ ...t, dono: dono.nome, meu: usuarioId === usuario.id }));
}

export async function revogarToken(usuario: UsuarioSessao, id: string): Promise<{ erros: string[] }> {
  const token = await prisma.tokenApi.findUnique({ where: { id } });
  if (!token || (token.usuarioId !== usuario.id && usuario.perfil !== "ADMIN")) return { erros: ["Acesso não encontrado."] };
  if (token.revogadoEm) return { erros: ["Este acesso já estava revogado."] };
  const agora = new Date();
  await prisma.$transaction(async (tx) => {
    const r = await tx.tokenApi.updateMany({ where: { id, revogadoEm: null }, data: { revogadoEm: agora } });
    if (r.count === 0) return;
    await tx.eventoAuditoria.createMany({
      data: compararCampos("TokenApi", id, usuario.id, { revogadoEm: null }, { revogadoEm: agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) }),
    });
  });
  return { erros: [] };
}

export type Autenticacao =
  | { ok: true; usuario: UsuarioSessao; tokenId: string }
  | { ok: false; status: 401 | 403; mensagem: string };

const NAO_AUTORIZADO = { ok: false, status: 401, mensagem: "Token inválido ou revogado. Gere um novo em Conectar o Claude." } as const;

/** Token → usuário dono, se o token vale e o usuário está ativo e usa o CRM. Marca o último uso. */
export async function autenticarToken(token: string): Promise<Autenticacao> {
  if (!pareceToken(token)) return NAO_AUTORIZADO;
  const salvo = await prisma.tokenApi.findUnique({
    where: { hash: hashDoToken(token) },
    include: { usuario: { include: { fabricas: { select: { fabricaId: true } } } } },
  });
  if (!salvo || salvo.revogadoEm || !salvo.usuario.ativo) return NAO_AUTORIZADO;
  const perfil = salvo.usuario.perfil as PerfilUsuario;
  if (!podeVerCrm({ perfil })) return { ok: false, status: 403, mensagem: SEM_PERMISSAO };

  await prisma.tokenApi.update({ where: { id: salvo.id }, data: { ultimoUsoEm: new Date() } });
  return {
    ok: true,
    tokenId: salvo.id,
    usuario: { id: salvo.usuario.id, nome: salvo.usuario.nome, perfil, fabricasIds: salvo.usuario.fabricas.map((f) => f.fabricaId) },
  };
}
