// Links que o Supabase manda por e-mail (convite e recuperação de senha). Dependendo de
// como o e-mail foi disparado, o resultado chega de três jeitos; este módulo só lê a URL,
// sem rede nem navegador, e quem chama decide o que fazer.
//   ?code=…                       fluxo PKCE: recuperação pedida pelo navegador
//   #access_token=…&refresh_token=…   fluxo implícito: convite (painel ou API admin)
//   #error=…&error_code=…         link vencido ou já usado

export type LinkDeAcesso =
  | { tipo: "codigo"; codigo: string }
  | { tipo: "tokens"; accessToken: string; refreshToken: string }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "nenhum" };

const LINK_VENCIDO = "Este link expirou ou já foi usado. Peça um novo.";

export function interpretarLinkDeAcesso(search: string, hash: string): LinkDeAcesso {
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const fragmento = new URLSearchParams(hash.replace(/^#/, ""));
  const campo = (nome: string) => fragmento.get(nome) ?? query.get(nome);

  if (campo("error") || campo("error_code")) return { tipo: "erro", mensagem: LINK_VENCIDO };

  const accessToken = fragmento.get("access_token");
  const refreshToken = fragmento.get("refresh_token");
  if (accessToken && refreshToken) return { tipo: "tokens", accessToken, refreshToken };

  const codigo = query.get("code");
  if (codigo) return { tipo: "codigo", codigo };

  return { tipo: "nenhum" };
}

// Destino pós-login vindo da URL: só caminho do próprio site. "//host" e "/\host" são
// lidos pelo navegador como outro domínio, por isso também caem no padrão.
export function caminhoInterno(destino: string | null | undefined, padrao: string): string {
  if (!destino || !destino.startsWith("/") || destino.startsWith("//") || destino.includes("\\")) return padrao;
  return destino;
}

const TIPOS = ["invite", "recovery", "email", "magiclink", "signup", "email_change"] as const;
export type TipoDeLink = (typeof TIPOS)[number];

export function tipoDeLinkValido(tipo: string | null | undefined): tipo is TipoDeLink {
  return !!tipo && (TIPOS as readonly string[]).includes(tipo);
}

// Convite tem texto próprio na tela ("crie sua senha" em vez de "senha nova"). O tipo vem
// no fragmento (#type=invite) ou no ?tipo=convite que o próprio convite pede em redirectTo.
export function ehConvite(search: string, hash: string): boolean {
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const fragmento = new URLSearchParams(hash.replace(/^#/, ""));
  return fragmento.get("type") === "invite" || query.get("type") === "invite" || query.get("tipo") === "convite";
}
