import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { caminhoInterno, tipoDeLinkValido } from "@/domain/auth/link";

// Destino dos links de e-mail (convite, recuperação) quando o modelo de e-mail do Supabase
// aponta para cá: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
// É o padrão recomendado para SSR: a troca do token acontece no servidor, sem depender do
// navegador que pediu o e-mail (o PKCE exige o mesmo navegador) e sem token na URL final.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");
  const padrao = tipo === "invite" || tipo === "recovery" ? "/login/nova-senha" : "/";
  const destino = caminhoInterno(searchParams.get("next"), padrao);

  const falha = new URL("/login/nova-senha?error=link", request.url);
  if (!tokenHash || !tipoDeLinkValido(tipo)) return NextResponse.redirect(falha);

  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (lista) => lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });

  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error) return NextResponse.redirect(falha);

  const url = new URL(destino, request.url);
  if (tipo === "invite") url.searchParams.set("tipo", "convite");
  return NextResponse.redirect(url);
}
