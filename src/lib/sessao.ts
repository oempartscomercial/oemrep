import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { PerfilUsuario } from "./authz";

export type UsuarioSessao = {
  id: string;
  nome: string;
  perfil: PerfilUsuario;
  fabricasIds: string[];
};

type UsuarioComFabricas = {
  id: string;
  nome: string;
  perfil: string;
  fabricas: { fabricaId: string }[];
};

function paraSessao(usuario: UsuarioComFabricas): UsuarioSessao {
  return {
    id: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil as PerfilUsuario,
    fabricasIds: usuario.fabricas.map((f) => f.fabricaId),
  };
}

export async function obterUsuarioLogado(): Promise<UsuarioSessao | null> {
  // Só em dev local (.env), nunca em produção: assume a identidade de um usuário
  // real do banco para que a navegação sem login sirva para verificação visual.
  // Usar uma linha real (e não uma sessão fictícia) mantém válidos o escopo por
  // fábrica (ADR-009) e as FKs de auditoria. Em build de produção o Next substitui
  // NODE_ENV por "production" e este bloco vira código morto.
  if (process.env.SKIP_AUTH === "true" && process.env.NODE_ENV !== "production") {
    const email = process.env.SKIP_AUTH_EMAIL;
    if (!email) return null;

    const usuarioDev = await prisma.usuario.findUnique({
      where: { email },
      include: { fabricas: true },
    });
    return usuarioDev ? paraSessao(usuarioDev) : null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  let usuario = await prisma.usuario.findUnique({
    where: { supabaseUserId: data.user.id },
    include: { fabricas: true },
  });

  // ADR-010: usuário cadastrado só com e-mail ainda não tem vínculo ao login
  // Supabase. No 1º acesso, casamos pelo e-mail e gravamos o supabaseUserId.
  if (!usuario && data.user.email) {
    const porEmail = await prisma.usuario.findUnique({
      where: { email: data.user.email },
      include: { fabricas: true },
    });
    if (porEmail && !porEmail.supabaseUserId) {
      usuario = await prisma.usuario.update({
        where: { id: porEmail.id },
        data: { supabaseUserId: data.user.id },
        include: { fabricas: true },
      });
    } else {
      usuario = porEmail;
    }
  }

  return usuario ? paraSessao(usuario) : null;
}
