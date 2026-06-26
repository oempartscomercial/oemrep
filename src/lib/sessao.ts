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

export async function obterUsuarioLogado(): Promise<UsuarioSessao | null> {
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

  const usuario = await prisma.usuario.findUnique({
    where: { supabaseUserId: data.user.id },
    include: { fabricas: true },
  });
  if (!usuario) return null;

  return {
    id: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil as PerfilUsuario,
    fabricasIds: usuario.fabricas.map((f) => f.fabricaId),
  };
}
