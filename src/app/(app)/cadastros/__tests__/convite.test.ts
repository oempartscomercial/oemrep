import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/origem", () => ({ origemDoApp: async () => "https://app.teste" }));
const inviteMock = vi.fn(async (..._args: unknown[]) => ({ error: null as { message: string; status?: number; code?: string } | null }));
vi.mock("@/lib/supabase-admin", () => ({ criarClienteAdmin: () => ({ auth: { admin: { inviteUserByEmail: inviteMock } } }) }));

import { convidarUsuario, criarUsuario } from "../usuarios/actions";
import { validarAcesso } from "@/app/login/actions";

afterEach(() => {
  obterUsuarioLogadoMock.mockReset();
  inviteMock.mockClear();
  inviteMock.mockResolvedValue({ error: null });
});

let n = 0;
async function cenario(perfil: "ADMIN" | "ANALISTA" = "ADMIN") {
  n += 1;
  const sufixo = `${Date.now()}${n}`;
  const admin = await prisma.usuario.create({ data: { nome: "Admin Convite", email: `adm-${sufixo}@teste.local`, perfil } });
  obterUsuarioLogadoMock.mockResolvedValue({ id: admin.id, nome: admin.nome, perfil, fabricasIds: [] });
  const alvo = await prisma.usuario.create({ data: { nome: "Pessoa Nova", email: `novo-${sufixo}@teste.local`, perfil: "OPERADOR" } });
  const limpar = async () => {
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, alvo.id] } } });
    await prisma.usuario.deleteMany({ where: { email: { startsWith: `criado-${sufixo}` } } });
  };
  return { admin, alvo, sufixo, limpar };
}

describe("convidarUsuario", () => {
  it("convida o e-mail cadastrado e registra na auditoria", async () => {
    const { alvo, admin, limpar } = await cenario();
    expect(await convidarUsuario(alvo.id)).toEqual({ erros: [] });
    expect(inviteMock).toHaveBeenCalledWith(alvo.email, { redirectTo: "https://app.teste/login/nova-senha?tipo=convite", data: { nome: "Pessoa Nova" } });
    const evento = await prisma.eventoAuditoria.findFirst({ where: { entidadeId: alvo.id, campo: "conviteEnviadoEm", usuarioId: admin.id } });
    expect(evento).not.toBeNull();
    await limpar();
  });

  it("só ADMIN convida", async () => {
    const { alvo, limpar } = await cenario("ANALISTA");
    expect((await convidarUsuario(alvo.id)).erros).toEqual(["Apenas ADMIN pode alterar usuários."]);
    expect(inviteMock).not.toHaveBeenCalled();
    await limpar();
  });

  it("não convida usuário desativado", async () => {
    const { alvo, limpar } = await cenario();
    await prisma.usuario.update({ where: { id: alvo.id }, data: { ativo: false } });
    expect((await convidarUsuario(alvo.id)).erros[0]).toMatch(/desativado/);
    expect(inviteMock).not.toHaveBeenCalled();
    await limpar();
  });

  it("mostra o motivo quando o Supabase recusa", async () => {
    const { alvo, limpar } = await cenario();
    inviteMock.mockResolvedValue({ error: { message: "already been registered", status: 422, code: "email_exists" } });
    expect((await convidarUsuario(alvo.id)).erros[0]).toMatch(/Esqueci minha senha/);
    await limpar();
  });
});

describe("criarUsuario com convite", () => {
  function formulario(email: string, convite: boolean) {
    const f = new FormData();
    f.set("nome", "Fulano Criado");
    f.set("email", email);
    f.set("perfil", "ADMIN");
    if (convite) f.set("enviarConvite", "on");
    return f;
  }

  it("cadastra e convida quando a caixa está marcada", async () => {
    const { sufixo, limpar } = await cenario();
    const email = `criado-${sufixo}@teste.local`;
    expect(await criarUsuario(formulario(email, true))).toEqual({ erros: [] });
    expect(inviteMock).toHaveBeenCalledWith(email, expect.objectContaining({ redirectTo: "https://app.teste/login/nova-senha?tipo=convite" }));
    await limpar();
  });

  it("cadastra sem convidar quando a caixa está desmarcada", async () => {
    const { sufixo, limpar } = await cenario();
    expect(await criarUsuario(formulario(`criado-${sufixo}@teste.local`, false))).toEqual({ erros: [] });
    expect(inviteMock).not.toHaveBeenCalled();
    await limpar();
  });

  it("mantém o cadastro e avisa quando o e-mail do convite falha", async () => {
    const { sufixo, limpar } = await cenario();
    const email = `criado-${sufixo}@teste.local`;
    inviteMock.mockResolvedValue({ error: { message: "rate limit", status: 429 } });
    const r = await criarUsuario(formulario(email, true));
    expect(r.erros[0]).toMatch(/Usuário cadastrado, mas o convite não saiu/);
    expect(await prisma.usuario.findUnique({ where: { email } })).not.toBeNull();
    await limpar();
  });
});

describe("validarAcesso", () => {
  it("libera quem tem cadastro ativo", async () => {
    obterUsuarioLogadoMock.mockResolvedValue({ id: "x", nome: "X", perfil: "ADMIN", fabricasIds: [] });
    expect(await validarAcesso()).toEqual({ ok: true });
  });
  it("explica quando o e-mail logou no Supabase mas não tem cadastro", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(null);
    const r = await validarAcesso();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/administrador/);
  });
});
