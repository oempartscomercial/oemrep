"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obterUsuarioLogado, type UsuarioSessao } from "@/lib/sessao";
import { origemDoApp } from "@/lib/origem";
import { lerChatwoot, lerEvolution, salvarChatwoot, salvarEvolution, salvarSegredoDoWebhook } from "@/lib/integracoes/config";
import { clienteEvolution, EVENTOS_DO_WEBHOOK, type EstadoDaInstancia } from "@/lib/integracoes/evolution-api";
import { testarChatwoot } from "@/lib/integracoes/chatwoot-api";
import { ErroDeCifra } from "@/lib/integracoes/cifra";

// Tela Integrações (ADR-019): só ADMIN. Nenhuma ação devolve segredo; as que falam com a Evolution
// ou o Chatwoot usam a configuração salva (salve antes de testar).

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SO_ADMIN = "Só administradores mexem nas integrações.";
const SALVE_ANTES = "Salve a configuração da Evolution antes.";

type Resultado = { erros: string[] };

async function sessaoAdmin(): Promise<{ usuario: UsuarioSessao } | { erro: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: SEM_SESSAO };
  if (usuario.perfil !== "ADMIN") return { erro: SO_ADMIN };
  return { usuario };
}

async function evolutionSalva(): Promise<{ cfg: NonNullable<Awaited<ReturnType<typeof lerEvolution>>> } | { erro: string }> {
  try {
    const cfg = await lerEvolution();
    return cfg ? { cfg } : { erro: SALVE_ANTES };
  } catch (erro) {
    return { erro: erro instanceof ErroDeCifra ? erro.message : "Não consegui ler a configuração salva." };
  }
}

export async function salvarEvolutionAcao(entrada: { url: string; instancia: string; apikey?: string; envioAutomatico: boolean }): Promise<Resultado> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  const r = await salvarEvolution(s.usuario, entrada);
  if (r.erros.length === 0) revalidatePath("/integracoes");
  return r;
}

export async function salvarChatwootAcao(entrada: { url: string; conta: string; token?: string }): Promise<Resultado> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  const r = await salvarChatwoot(s.usuario, entrada);
  if (r.erros.length === 0) revalidatePath("/integracoes");
  return r;
}

export type TesteEvolution = Resultado & { mensagem?: string; estado?: EstadoDaInstancia };

/** Confere endereço e chave, e diz se a instância existe e se o celular está conectado. */
export async function testarEvolutionAcao(): Promise<TesteEvolution> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  const salva = await evolutionSalva();
  if ("erro" in salva) return { erros: [salva.erro] };
  const cliente = clienteEvolution(salva.cfg);
  const teste = await cliente.testar();
  if (!teste.ok) return { erros: [teste.erro] };
  const estado = await cliente.estado();
  const mensagem = teste.instanciaExiste
    ? `Conexão com a Evolution OK. A instância "${salva.cfg.instancia}" existe.`
    : `Conexão com a Evolution OK, mas a instância "${salva.cfg.instancia}" não existe. Use "Criar instância".`;
  return { erros: [], mensagem, estado };
}

export async function estadoEvolutionAcao(): Promise<Resultado & { estado?: EstadoDaInstancia }> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  const salva = await evolutionSalva();
  if ("erro" in salva) return { erros: [salva.erro] };
  return { erros: [], estado: await clienteEvolution(salva.cfg).estado() };
}

export type QrCode = Resultado & { imagem?: string; codigoPareamento?: string | null; conectado?: boolean };

export async function qrCodeAcao(): Promise<QrCode> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  const salva = await evolutionSalva();
  if ("erro" in salva) return { erros: [salva.erro] };
  const qr = await clienteEvolution(salva.cfg).qrCode();
  if (qr.tipo === "erro") return { erros: [qr.erro] };
  if (qr.tipo === "conectada") return { erros: [], conectado: true };
  return { erros: [], imagem: qr.imagem, codigoPareamento: qr.codigoPareamento };
}

export async function criarInstanciaAcao(): Promise<Resultado> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  const salva = await evolutionSalva();
  if ("erro" in salva) return { erros: [salva.erro] };
  const cliente = clienteEvolution(salva.cfg);
  const teste = await cliente.testar();
  if (!teste.ok) return { erros: [teste.erro] };
  if (teste.instanciaExiste) return { erros: [`A instância "${salva.cfg.instancia}" já existe.`] };
  const r = await cliente.criarInstancia();
  return r.ok ? { erros: [] } : { erros: [r.erro] };
}

const CAMINHO_DO_WEBHOOK = "/api/whatsapp/prospeccao/webhook";
const ehLocal = (origem: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(origem);

export type ResultadoDoWebhook = Resultado & { conferido?: boolean; precisaConfirmar?: { urlAtual: string } };

/**
 * Aponta o webhook da instância para o sistema (mensagens recebidas e enviadas, recibos e conexão).
 * Só mexe no webhook: a integração da Evolution com o Chatwoot é outra e continua como está. Se a
 * instância já manda o webhook para outro endereço, pede confirmação antes de trocar.
 */
export async function configurarWebhookAcao(entrada: { substituir?: boolean } = {}): Promise<ResultadoDoWebhook> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  const salva = await evolutionSalva();
  if ("erro" in salva) return { erros: [salva.erro] };
  if (salva.cfg.origem !== "tela") return { erros: [SALVE_ANTES] };

  const origem = await origemDoApp();
  if (ehLocal(origem)) return { erros: [`O endereço deste sistema é local (${origem}): a Evolution não consegue chamá-lo. Configure pelo endereço publicado (NEXT_PUBLIC_SITE_URL).`] };
  const destino = `${origem}${CAMINHO_DO_WEBHOOK}`;

  const cliente = clienteEvolution(salva.cfg);
  const atual = await cliente.lerWebhook();
  const urlAtual = atual?.ligado ? atual.url : null;
  if (urlAtual && !urlAtual.startsWith(destino) && !entrada.substituir) {
    // Mostra só o endereço, sem a consulta (que pode ter segredo de outro sistema).
    return { erros: [], precisaConfirmar: { urlAtual: urlAtual.split("?")[0] } };
  }

  // Reaproveita o segredo já combinado: trocar a cada clique derrubaria eventos em trânsito.
  const segredo = salva.cfg.webhookSegredo ?? randomBytes(24).toString("hex");
  const r = await cliente.configurarWebhook(`${destino}?segredo=${segredo}`, segredo);
  if (!r.ok) return { erros: [r.erro] };
  const gravou = await salvarSegredoDoWebhook(s.usuario, segredo);
  if (gravou.erros.length > 0) return gravou;

  const conferido = await cliente.lerWebhook();
  const ok = !!conferido?.ligado && !!conferido.url?.startsWith(destino) && EVENTOS_DO_WEBHOOK.every((e) => conferido.eventos.includes(e));
  revalidatePath("/integracoes");
  return { erros: [], conferido: ok };
}

export async function testarChatwootAcao(): Promise<Resultado & { mensagem?: string }> {
  const s = await sessaoAdmin();
  if ("erro" in s) return { erros: [s.erro] };
  let cfg: Awaited<ReturnType<typeof lerChatwoot>>;
  try {
    cfg = await lerChatwoot();
  } catch (erro) {
    return { erros: [erro instanceof ErroDeCifra ? erro.message : "Não consegui ler a configuração salva."] };
  }
  if (!cfg) return { erros: ["Salve a configuração do Chatwoot antes."] };
  const r = await testarChatwoot(cfg);
  if (!r.ok) return { erros: [r.erro] };
  const caixas = r.caixas.length > 0 ? ` Caixas de entrada: ${r.caixas.join(", ")}.` : " Nenhuma caixa de entrada na conta.";
  return { erros: [], mensagem: `Conexão com o Chatwoot OK.${caixas}` };
}
