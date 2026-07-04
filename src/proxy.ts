import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rotaProtegida } from "@/lib/auth-guard";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Só em dev local (.env), nunca em produção: permite navegar sem login para
  // verificação visual manual. A suíte e2e força SKIP_AUTH=false (playwright.config.ts)
  // para sempre testar o redirecionamento real.
  if (process.env.SKIP_AUTH === "true") {
    return response;
  }

  if (!rotaProtegida(request.nextUrl.pathname)) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
