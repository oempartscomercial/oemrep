import { prisma } from "@/lib/prisma";
import { podeVerCrm, type PerfilUsuario } from "@/lib/authz";
import type { UsuarioSessao } from "@/lib/sessao";
import { compararCampos } from "@/domain/auditoria/evento";
import { marcarRevogado } from "./tokens";
import {
  ESCOPO,
  VALIDADE_ACESSO_S,
  VALIDADE_CODIGO_MS,
  VALIDADE_RENOVACAO_MS,
  pkceConfere,
  recursoConfere,
  validarRegistro,
  venceu,
  type PedidoAutorizacao,
} from "@/domain/mcp/oauth";
import { gerarSegredo, gerarToken, hashDoToken, pareceSegredo, pareceToken, prefixoDoToken } from "@/domain/mcp/token";

// Servidor de autorização OAuth do MCP (ADR-017), sobre o banco. As regras puras estão em
// src/domain/mcp/oauth.ts; aqui ficam registro de cliente, código, troca, renovação e revogação.
// Segredos (código, access, refresh) só existem em claro na resposta; no banco, o hash.

export type ErroOAuth = { ok: false; status: 400 | 401; erro: string; descricao: string };
export type RespostaToken = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string };

const concessaoInvalida = (descricao: string): ErroOAuth => ({ ok: false, status: 400, erro: "invalid_grant", descricao });
const NAO_PODE = concessaoInvalida("O usuário não está ativo ou não usa o CRM.");

// ---------------------------------------------------------------- clientes

export async function registrarCliente(corpo: unknown): Promise<{ ok: true; resposta: Record<string, unknown> } | ErroOAuth> {
  const v = validarRegistro(corpo);
  if (!v.ok) return { ok: false, status: 400, erro: v.erro, descricao: v.descricao };
  const cliente = await prisma.clienteOAuth.create({ data: { nome: v.nome, redirectUris: v.redirectUris } });
  return {
    ok: true,
    resposta: {
      client_id: cliente.id,
      client_id_issued_at: Math.floor(cliente.criadoEm.getTime() / 1000),
      client_name: cliente.nome,
      redirect_uris: cliente.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: ESCOPO,
    },
  };
}

export async function buscarClienteOAuth(id: string | null | undefined) {
  if (!id || id.length > 64) return null;
  return prisma.clienteOAuth.findUnique({ where: { id }, select: { id: true, nome: true, redirectUris: true } });
}

// ---------------------------------------------------------------- código de autorização

/** "Permitir" na tela de consentimento: código de uso único, 5 minutos. Devolve o código em claro. */
export async function emitirCodigo(usuario: UsuarioSessao, pedido: PedidoAutorizacao): Promise<string> {
  if (!podeVerCrm(usuario)) throw new Error("Usuário sem acesso ao CRM não recebe código.");
  const agora = new Date();
  const codigo = gerarSegredo("codigo");
  // Faxina: código vencido há mais de um dia não serve nem para detectar reuso.
  await prisma.codigoOAuth.deleteMany({ where: { expiraEm: { lt: new Date(agora.getTime() - 24 * 60 * 60_000) } } });
  await prisma.codigoOAuth.create({
    data: {
      hash: hashDoToken(codigo),
      clienteOAuthId: pedido.clientId,
      usuarioId: usuario.id,
      redirectUri: pedido.redirectUri,
      codeChallenge: pedido.codeChallenge,
      recurso: pedido.recurso,
      expiraEm: new Date(agora.getTime() + VALIDADE_CODIGO_MS),
    },
  });
  return codigo;
}

// ---------------------------------------------------------------- tokens

async function usuarioPodeUsar(usuarioId: string): Promise<boolean> {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, perfil: true } });
  return !!u && u.ativo && podeVerCrm({ perfil: u.perfil as PerfilUsuario });
}

function novosSegredos(agora: Date) {
  const acesso = gerarToken();
  const renovacao = gerarSegredo("renovacao");
  return {
    resposta: { access_token: acesso, token_type: "Bearer", expires_in: VALIDADE_ACESSO_S, refresh_token: renovacao, scope: ESCOPO } satisfies RespostaToken,
    dados: {
      hash: hashDoToken(acesso),
      prefixo: prefixoDoToken(acesso),
      expiraEm: new Date(agora.getTime() + VALIDADE_ACESSO_S * 1000),
      refreshHash: hashDoToken(renovacao),
      refreshExpiraEm: new Date(agora.getTime() + VALIDADE_RENOVACAO_MS),
    },
  };
}

type Troca = { codigo: string | undefined; clientId: string | undefined; redirectUri: string | undefined; verificador: string | undefined; recurso: string | undefined };

/** grant_type=authorization_code. O código queima na primeira tentativa, certa ou errada. */
export async function trocarCodigo(p: Troca, origem: string): Promise<{ ok: true; resposta: RespostaToken } | ErroOAuth> {
  if (!p.codigo || !p.clientId || !p.redirectUri || !p.verificador) {
    return { ok: false, status: 400, erro: "invalid_request", descricao: "Faltam code, client_id, redirect_uri ou code_verifier." };
  }
  if (!pareceSegredo("codigo", p.codigo)) return concessaoInvalida("Código inválido.");
  const salvo = await prisma.codigoOAuth.findUnique({ where: { hash: hashDoToken(p.codigo) }, include: { clienteOAuth: { select: { nome: true } } } });
  if (!salvo) return concessaoInvalida("Código inválido.");

  const agora = new Date();
  const queimado = await prisma.codigoOAuth.updateMany({ where: { id: salvo.id, usadoEm: null }, data: { usadoEm: agora } });
  if (queimado.count === 0) {
    // Código reapresentado: alguém pode tê-lo copiado. O acesso que ele gerou cai (RFC 6749 §4.1.2).
    if (salvo.tokenApiId) await marcarRevogado(salvo.tokenApiId, salvo.usuarioId, agora);
    return concessaoInvalida("Código já usado.");
  }
  if (venceu(salvo.expiraEm, agora)) return concessaoInvalida("Código vencido.");
  if (salvo.clienteOAuthId !== p.clientId) return concessaoInvalida("Código emitido para outro aplicativo.");
  if (salvo.redirectUri !== p.redirectUri) return concessaoInvalida("redirect_uri diferente do pedido de autorização.");
  if (!pkceConfere(p.verificador, salvo.codeChallenge)) return concessaoInvalida("code_verifier não confere (PKCE).");
  if (p.recurso && (!recursoConfere(p.recurso, origem) || salvo.recurso !== p.recurso.replace(/\/+$/, ""))) {
    return { ok: false, status: 400, erro: "invalid_target", descricao: "resource diferente do autorizado." };
  }
  if (!(await usuarioPodeUsar(salvo.usuarioId))) return NAO_PODE;

  const { resposta, dados } = novosSegredos(agora);
  await prisma.$transaction(async (tx) => {
    const t = await tx.tokenApi.create({
      data: { ...dados, usuarioId: salvo.usuarioId, nome: salvo.clienteOAuth.nome, origem: "OAUTH", clienteOAuthId: salvo.clienteOAuthId },
    });
    await tx.codigoOAuth.update({ where: { id: salvo.id }, data: { tokenApiId: t.id } });
    await tx.eventoAuditoria.createMany({
      data: compararCampos("TokenApi", t.id, salvo.usuarioId, {}, { nome: t.nome, origem: "OAUTH" }),
    });
  });
  return { ok: true, resposta };
}

type Renovacao = { refresh: string | undefined; clientId: string | undefined; recurso: string | undefined };

/** grant_type=refresh_token, com rotação: o refresh e o access anteriores deixam de valer. */
export async function renovarAcesso(p: Renovacao, origem: string): Promise<{ ok: true; resposta: RespostaToken } | ErroOAuth> {
  if (!p.refresh || !p.clientId) return { ok: false, status: 400, erro: "invalid_request", descricao: "Faltam refresh_token ou client_id." };
  if (!pareceSegredo("renovacao", p.refresh)) return concessaoInvalida("Refresh token inválido.");
  const hashAntigo = hashDoToken(p.refresh);
  const salvo = await prisma.tokenApi.findUnique({ where: { refreshHash: hashAntigo } });
  const agora = new Date();
  if (!salvo || salvo.revogadoEm || venceu(salvo.refreshExpiraEm, agora)) return concessaoInvalida("Refresh token inválido, vencido ou revogado.");
  if (salvo.clienteOAuthId !== p.clientId) return concessaoInvalida("Refresh token de outro aplicativo.");
  if (!recursoConfere(p.recurso, origem)) return { ok: false, status: 400, erro: "invalid_target", descricao: "resource diferente do autorizado." };
  if (!(await usuarioPodeUsar(salvo.usuarioId))) return NAO_PODE;

  const { resposta, dados } = novosSegredos(agora);
  // Só um pedido de renovação ganha: o segundo, com o mesmo refresh, acha o hash já trocado.
  const r = await prisma.tokenApi.updateMany({ where: { id: salvo.id, refreshHash: hashAntigo, revogadoEm: null }, data: dados });
  if (r.count === 0) return concessaoInvalida("Refresh token já usado.");
  return { ok: true, resposta };
}

/** RFC 7009: revoga o acesso OAuth dono do token (access ou refresh). Token desconhecido não é erro. */
export async function revogarPorSegredo(segredo: string | undefined, clientId: string | undefined): Promise<void> {
  if (!segredo) return;
  const onde = pareceToken(segredo) ? { hash: hashDoToken(segredo) } : pareceSegredo("renovacao", segredo) ? { refreshHash: hashDoToken(segredo) } : null;
  if (!onde) return;
  const salvo = await prisma.tokenApi.findFirst({ where: { ...onde, origem: "OAUTH" } });
  if (!salvo || (clientId && salvo.clienteOAuthId !== clientId)) return;
  await marcarRevogado(salvo.id, salvo.usuarioId, new Date());
}
