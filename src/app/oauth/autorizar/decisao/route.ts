import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { origemDaRequisicao, pedidoDoProprioSite } from "@/lib/origem";
import { buscarClienteOAuth, emitirCodigo } from "@/lib/mcp/oauth";
import { urlComParametros, validarPedidoAutorizacao } from "@/domain/mcp/oauth";

// Botões da tela de consentimento (/oauth/autorizar): Permitir gera o código e volta para o Claude;
// Cancelar volta com access_denied. Formulário HTML comum (navegação completa, sem JS). Só aceita
// POST do próprio site: sem isso, outra página poderia "clicar em Permitir" por quem está logado.
export const dynamic = "force-dynamic";

const CAMPOS = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "resource"] as const;

const irPara = (url: string) => new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });

export async function POST(request: Request) {
  if (!pedidoDoProprioSite(request)) return new Response("Pedido recusado: não veio da tela de autorização.", { status: 403 });
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const campo of CAMPOS) {
    const v = form.get(campo);
    if (typeof v === "string") params.set(campo, v);
  }

  const cliente = await buscarClienteOAuth(params.get("client_id"));
  const r = validarPedidoAutorizacao(params, cliente, origemDaRequisicao(request));
  if (!r.ok) return r.redirecionar ? irPara(r.url) : new Response(r.mensagem, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  const { pedido } = r;
  const negar = () => irPara(urlComParametros(pedido.redirectUri, { error: "access_denied", error_description: "A pessoa não permitiu o acesso.", state: pedido.state }));

  if (form.get("decisao") !== "permitir") return negar();
  const usuario = await obterUsuarioLogado();
  if (!usuario) return irPara(`/login?proximo=${encodeURIComponent(`/oauth/autorizar?${params}`)}`);
  if (!podeVerCrm(usuario)) return negar();

  const codigo = await emitirCodigo(usuario, pedido);
  return irPara(urlComParametros(pedido.redirectUri, { code: codigo, state: pedido.state }));
}
