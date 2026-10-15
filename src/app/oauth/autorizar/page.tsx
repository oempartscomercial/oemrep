import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { origemDoApp } from "@/lib/origem";
import { buscarClienteOAuth } from "@/lib/mcp/oauth";
import { validarPedidoAutorizacao, type PedidoAutorizacao } from "@/domain/mcp/oauth";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Botao } from "@/components/patterns/botao";
import { BotaoSair } from "./botao-sair";

// Tela de consentimento do OAuth (ADR-017): o Claude manda a pessoa para cá, ela vê quem está
// pedindo e clica em Permitir. Exige sessão: sem login, vai para /login e volta para cá depois.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Para onde a pessoa volta depois de decidir, dito de um jeito que ela reconhece. */
function destino(redirectUri: string): string {
  const { hostname } = new URL(redirectUri);
  return LOCAIS.has(hostname) ? "o Claude Code, neste computador" : hostname;
}

function CamposOcultos({ pedido }: { pedido: PedidoAutorizacao }) {
  const campos: Record<string, string | null> = {
    client_id: pedido.clientId,
    redirect_uri: pedido.redirectUri,
    response_type: "code",
    code_challenge: pedido.codeChallenge,
    code_challenge_method: "S256",
    resource: pedido.recurso,
    state: pedido.state,
  };
  return Object.entries(campos).map(([nome, valor]) => (valor === null ? null : <input key={nome} type="hidden" name={nome} value={valor} />));
}

export default async function AutorizarPage({ searchParams }: Props) {
  const brutos = await searchParams;
  const params = new URLSearchParams(Object.entries(brutos).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  const voltaAqui = `/oauth/autorizar?${params}`;

  const cliente = await buscarClienteOAuth(params.get("client_id"));
  const r = validarPedidoAutorizacao(params, cliente, await origemDoApp());
  if (!r.ok && r.redirecionar) redirect(r.url);
  if (!r.ok || !cliente) {
    return (
      <AuthLayout titulo="Não deu para conectar">
        <p className="text-sm">{r.ok ? "" : r.mensagem}</p>
      </AuthLayout>
    );
  }

  const usuario = await obterUsuarioLogado();
  if (!usuario) redirect(`/login?proximo=${encodeURIComponent(voltaAqui)}`);
  const conta = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { email: true } });
  const pode = podeVerCrm(usuario);

  return (
    <AuthLayout titulo="Conectar o Claude ao CRM">
      <form method="post" action="/oauth/autorizar/decisao" className="flex flex-col gap-4">
        <CamposOcultos pedido={r.pedido} />
        {pode ? (
          <>
            <p className="text-sm leading-relaxed">
              O <strong>{cliente.nome}</strong> quer acessar o CRM da OEM em seu nome: ver agenda, empresas e carteira, e anotar conversas e próximos passos.
              Tudo que ele gravar fica marcado “pelo Claude”.
            </p>
            <p className="text-xs text-muted-foreground">
              Depois de permitir, você volta para {destino(r.pedido.redirectUri)}. Dá para desligar quando quiser, na tela Conectar o Claude.
            </p>
            <div className="flex flex-col gap-2">
              <Botao type="submit" name="decisao" value="permitir" variante="primario" className="h-11 w-full md:h-9">
                Permitir
              </Botao>
              <Botao type="submit" name="decisao" value="cancelar" variante="secundario" className="h-11 w-full md:h-9">
                Cancelar
              </Botao>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed">
              Seu perfil não usa o CRM, então não dá para conectar o Claude à sua conta. Se precisar, fale com o administrador.
            </p>
            <Botao type="submit" name="decisao" value="cancelar" variante="secundario" className="h-11 w-full md:h-9">
              Voltar ao Claude
            </Botao>
          </>
        )}
      </form>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        Entrou como <strong className="text-foreground">{usuario.nome}</strong>
        {conta?.email ? ` (${conta.email})` : ""}. Não é você? <BotaoSair proximo={voltaAqui} />
      </p>
    </AuthLayout>
  );
}
