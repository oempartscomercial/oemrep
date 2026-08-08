import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../prisma";

// Fora do SKIP_AUTH, obterUsuarioLogado depende do cookie do Supabase, que não
// existe num teste de node. Simulamos "ninguém autenticado" para que o único
// caminho capaz de devolver um usuário seja o atalho de desenvolvimento.
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

import { obterUsuarioLogado } from "../sessao";

const EMAIL_DEV = "dev-skip-auth@exemplo.com";
const CNPJ_FABRICA = "88000000000199";

let fabricaId: string;
let usuarioId: string;

beforeAll(async () => {
  const fabrica = await prisma.fabrica.create({
    data: { nome: "Fábrica SKIP_AUTH", cnpj: CNPJ_FABRICA },
  });
  fabricaId = fabrica.id;

  const usuario = await prisma.usuario.create({
    data: {
      nome: "Dev Local",
      email: EMAIL_DEV,
      perfil: "OPERADOR",
      fabricas: { create: [{ fabricaId: fabrica.id }] },
    },
  });
  usuarioId = usuario.id;
});

afterAll(async () => {
  await prisma.usuarioFabrica.deleteMany({ where: { usuarioId } });
  await prisma.usuario.delete({ where: { id: usuarioId } });
  await prisma.fabrica.delete({ where: { id: fabricaId } });
});

// vitest.config.ts carrega o .env, então SKIP_AUTH já vem definido do ambiente
// do desenvolvedor. Cada teste declara o seu via stubEnv e desfazemos depois.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("obterUsuarioLogado — sessão de desenvolvimento (SKIP_AUTH)", () => {
  it("devolve o usuário de SKIP_AUTH_EMAIL, com suas fábricas, sem cookie do Supabase", async () => {
    vi.stubEnv("SKIP_AUTH", "true");
    vi.stubEnv("SKIP_AUTH_EMAIL", EMAIL_DEV);
    vi.stubEnv("NODE_ENV", "development");

    const sessao = await obterUsuarioLogado();

    expect(sessao).toEqual({
      id: usuarioId,
      nome: "Dev Local",
      perfil: "OPERADOR",
      fabricasIds: [fabricaId],
    });
  });

  it("ignora SKIP_AUTH quando NODE_ENV é production", async () => {
    vi.stubEnv("SKIP_AUTH", "true");
    vi.stubEnv("SKIP_AUTH_EMAIL", EMAIL_DEV);
    vi.stubEnv("NODE_ENV", "production");

    expect(await obterUsuarioLogado()).toBeNull();
  });

  it("devolve null quando SKIP_AUTH_EMAIL não casa com nenhum usuário", async () => {
    vi.stubEnv("SKIP_AUTH", "true");
    vi.stubEnv("SKIP_AUTH_EMAIL", "ninguem@exemplo.com");
    vi.stubEnv("NODE_ENV", "development");

    expect(await obterUsuarioLogado()).toBeNull();
  });

  it("devolve null quando SKIP_AUTH_EMAIL não está definido", async () => {
    vi.stubEnv("SKIP_AUTH", "true");
    vi.stubEnv("SKIP_AUTH_EMAIL", undefined);
    vi.stubEnv("NODE_ENV", "development");

    expect(await obterUsuarioLogado()).toBeNull();
  });

  it("ignora o atalho quando SKIP_AUTH não é 'true'", async () => {
    vi.stubEnv("SKIP_AUTH", "false");
    vi.stubEnv("SKIP_AUTH_EMAIL", EMAIL_DEV);
    vi.stubEnv("NODE_ENV", "development");

    expect(await obterUsuarioLogado()).toBeNull();
  });
});
