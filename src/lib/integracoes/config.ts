import { cache } from "react";
import type { Integracao, TipoIntegracao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compararCampos } from "@/domain/auditoria/evento";
import { finalDoSegredo, mascararSegredo } from "@/domain/integracoes/segredo";
import { validarChatwoot, validarEvolution, type EntradaChatwoot, type EntradaEvolution } from "@/domain/integracoes/validacao";
import { cifrar, decifrar, ErroDeCifra, lerChave } from "./cifra";

// Configuração das integrações (ADR-019): a tela Integrações grava aqui, e o transporte, o
// webhook e o MCP leem daqui. A tela manda quando existe; sem ela, valem as variáveis antigas
// (EVOLUTION_*), como antes. Segredo só sai decifrado para quem chama a Evolution, nunca para a tela.

type Ambiente = Record<string, string | undefined>;
type Autor = { id: string; nome: string };

export type ConfigEvolution = {
  url: string;
  apikey: string;
  instancia: string;
  /** Falso = a aprovada não sai sozinha: a pessoa envia pelo celular e toca em "Já enviei". */
  envioAutomatico: boolean;
  /** Segredo que o sistema pediu para a Evolution mandar no webhook (nulo = webhook não configurado pela tela). */
  webhookSegredo: string | null;
  origem: "tela" | "ambiente";
};
export type ConfigChatwoot = { url: string; conta: string; token: string };

export const SEM_CHAVE =
  "Falta configurar a variável INTEGRACOES_CHAVE no servidor (Vercel): sem ela os segredos não podem ser guardados cifrados. Peça ao Arthur.";

export const cifraConfigurada = (env: Ambiente = process.env) => lerChave(env) !== null;

// Uma leitura por tipo em cada requisição (render de página); fora dela, cada chamada vai ao banco.
const linhaDa = cache((tipo: TipoIntegracao) => prisma.integracao.findUnique({ where: { tipo } }));

function chaveObrigatoria(env: Ambiente): Buffer {
  const chave = lerChave(env);
  if (!chave) throw new ErroDeCifra(SEM_CHAVE);
  return chave;
}

/** Configuração da Evolution: a da tela; sem ela, a das variáveis EVOLUTION_*. Lança ErroDeCifra se a salva não abre. */
export async function lerEvolution(env: Ambiente = process.env): Promise<ConfigEvolution | null> {
  const linha = await linhaDa("EVOLUTION");
  if (linha) {
    const chave = chaveObrigatoria(env);
    return {
      url: linha.url,
      apikey: decifrar(linha.segredoCifrado, chave),
      instancia: linha.instancia ?? "",
      envioAutomatico: linha.envioAutomatico,
      webhookSegredo: linha.webhookSegredoCifrado ? decifrar(linha.webhookSegredoCifrado, chave) : null,
      origem: "tela",
    };
  }
  const { EVOLUTION_URL: url, EVOLUTION_APIKEY: apikey, EVOLUTION_INSTANCIA_PROSPECCAO: instancia } = env;
  if (!url || !apikey || !instancia) return null;
  return {
    url,
    apikey,
    instancia,
    // Regra antiga: só envia com o transporte escolhido E o interruptor ligado de propósito.
    envioAutomatico: env.WHATSAPP_TRANSPORTE === "evolution" && env.WHATSAPP_ENVIO_HABILITADO === "true",
    webhookSegredo: null,
    origem: "ambiente",
  };
}

export async function lerChatwoot(env: Ambiente = process.env): Promise<ConfigChatwoot | null> {
  const linha = await linhaDa("CHATWOOT");
  if (!linha) return null;
  return { url: linha.url, conta: linha.conta ?? "", token: decifrar(linha.segredoCifrado, chaveObrigatoria(env)) };
}

/** Segredos que o webhook aceita: o gerado pela tela e o da variável antiga (os dois valem na transição). */
export async function segredosDoWebhook(env: Ambiente = process.env): Promise<string[]> {
  const segredos: string[] = [];
  if (env.WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO) segredos.push(env.WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO);
  try {
    const cfg = await lerEvolution(env);
    if (cfg?.webhookSegredo) segredos.push(cfg.webhookSegredo);
  } catch (erro) {
    console.error("[integracoes] não consegui ler o segredo do webhook salvo", erro instanceof Error ? erro.message : erro);
  }
  return segredos;
}

// --- Para a tela -------------------------------------------------------------------------------

export type ResumoEvolution = {
  url: string;
  instancia: string;
  segredo: string;
  envioAutomatico: boolean;
  webhookConfiguradoEm: Date | null;
  estadoConexao: string | null;
  estadoConexaoEm: Date | null;
  atualizadoEm: Date | null;
  atualizadoPor: string | null;
  origem: "tela" | "ambiente";
};
export type ResumoChatwoot = { url: string; conta: string; segredo: string; atualizadoEm: Date; atualizadoPor: string | null };

/** O que a tela mostra: nunca o segredo, só o final mascarado. */
export async function resumoDasIntegracoes(env: Ambiente = process.env) {
  const [evolution, chatwoot] = await Promise.all(
    (["EVOLUTION", "CHATWOOT"] as const).map((tipo) => prisma.integracao.findUnique({ where: { tipo }, include: { atualizadoPor: { select: { nome: true } } } })),
  );
  const daTela = (l: NonNullable<typeof evolution>) => ({ segredo: mascararSegredo(l.segredoFinal), atualizadoEm: l.atualizadoEm, atualizadoPor: l.atualizadoPor?.nome ?? null });
  let resumoEvolution: ResumoEvolution | null = null;
  if (evolution) {
    resumoEvolution = {
      url: evolution.url,
      instancia: evolution.instancia ?? "",
      envioAutomatico: evolution.envioAutomatico,
      webhookConfiguradoEm: evolution.webhookConfiguradoEm,
      estadoConexao: evolution.estadoConexao,
      estadoConexaoEm: evolution.estadoConexaoEm,
      origem: "tela",
      ...daTela(evolution),
    };
  } else if (env.EVOLUTION_URL && env.EVOLUTION_APIKEY && env.EVOLUTION_INSTANCIA_PROSPECCAO) {
    resumoEvolution = {
      url: env.EVOLUTION_URL,
      instancia: env.EVOLUTION_INSTANCIA_PROSPECCAO,
      segredo: mascararSegredo(finalDoSegredo(env.EVOLUTION_APIKEY)),
      envioAutomatico: env.WHATSAPP_TRANSPORTE === "evolution" && env.WHATSAPP_ENVIO_HABILITADO === "true",
      webhookConfiguradoEm: null,
      estadoConexao: null,
      estadoConexaoEm: null,
      atualizadoEm: null,
      atualizadoPor: null,
      origem: "ambiente",
    };
  }
  return {
    cifraConfigurada: cifraConfigurada(env),
    evolution: resumoEvolution,
    chatwoot: chatwoot ? ({ url: chatwoot.url, conta: chatwoot.conta ?? "", ...daTela(chatwoot) } satisfies ResumoChatwoot) : null,
  };
}

// --- Gravação (só ADMIN chega aqui: quem chama confere) -------------------------------------------

type Resultado = { erros: string[] };

function eventosDoSegredo(tipo: TipoIntegracao, autor: Autor, campo: string, havia: boolean) {
  // O segredo nunca entra na auditoria, nem o final: só que foi trocado.
  return [{ entidade: "Integracao", entidadeId: tipo, campo, valorAnterior: havia ? "(guardada)" : null, valorNovo: "(nova, guardada cifrada)", usuarioId: autor.id }];
}

async function gravar(
  tipo: TipoIntegracao,
  autor: Autor,
  atual: Integracao | null,
  dados: { url: string; instancia?: string | null; conta?: string | null; envioAutomatico?: boolean; segredo: string | null },
  chave: Buffer,
) {
  const campos = { url: dados.url, instancia: dados.instancia ?? null, conta: dados.conta ?? null, ...(dados.envioAutomatico !== undefined ? { envioAutomatico: dados.envioAutomatico } : {}) };
  const segredo = dados.segredo ? { segredoCifrado: cifrar(dados.segredo, chave), segredoFinal: finalDoSegredo(dados.segredo) } : null;
  // Outro endereço ou outra instância: o webhook configurado era da antiga, precisa configurar de novo.
  const mudouDestino = atual !== null && (atual.url !== campos.url || atual.instancia !== campos.instancia);
  const antes: Record<string, unknown> = atual ? { url: atual.url, instancia: atual.instancia, conta: atual.conta, envioAutomatico: atual.envioAutomatico } : {};
  const depois: Record<string, unknown> = { url: campos.url, ...(tipo === "EVOLUTION" ? { instancia: campos.instancia } : { conta: campos.conta }), ...(dados.envioAutomatico !== undefined ? { envioAutomatico: dados.envioAutomatico } : {}) };

  await prisma.$transaction(async (tx) => {
    if (atual) {
      await tx.integracao.update({
        where: { tipo },
        data: { ...campos, ...(segredo ?? {}), ...(mudouDestino ? { webhookConfiguradoEm: null, estadoConexao: null, estadoConexaoEm: null } : {}), atualizadoPorId: autor.id },
      });
    } else {
      if (!segredo) throw new Error("segredo obrigatório na primeira vez");
      await tx.integracao.create({ data: { tipo, ...campos, ...segredo, atualizadoPorId: autor.id } });
    }
    await tx.eventoAuditoria.createMany({
      data: [
        ...compararCampos("Integracao", tipo, autor.id, antes, depois),
        ...(segredo ? eventosDoSegredo(tipo, autor, tipo === "EVOLUTION" ? "chave" : "token", atual !== null) : []),
      ],
    });
  });
}

export async function salvarEvolution(autor: Autor, entrada: EntradaEvolution & { envioAutomatico: boolean }, env: Ambiente = process.env): Promise<Resultado> {
  const chave = lerChave(env);
  if (!chave) return { erros: [SEM_CHAVE] };
  const atual = await prisma.integracao.findUnique({ where: { tipo: "EVOLUTION" } });
  const v = validarEvolution(entrada, atual !== null);
  if (!v.valores) return { erros: v.erros };
  await gravar("EVOLUTION", autor, atual, { url: v.valores.url, instancia: v.valores.instancia, envioAutomatico: entrada.envioAutomatico, segredo: v.valores.apikey }, chave);
  return { erros: [] };
}

export async function salvarChatwoot(autor: Autor, entrada: EntradaChatwoot, env: Ambiente = process.env): Promise<Resultado> {
  const chave = lerChave(env);
  if (!chave) return { erros: [SEM_CHAVE] };
  const atual = await prisma.integracao.findUnique({ where: { tipo: "CHATWOOT" } });
  const v = validarChatwoot(entrada, atual !== null);
  if (!v.valores) return { erros: v.erros };
  await gravar("CHATWOOT", autor, atual, { url: v.valores.url, conta: v.valores.conta, segredo: v.valores.token }, chave);
  return { erros: [] };
}

/** Depois que a Evolution aceitou o webhook: guarda o segredo que ela vai mandar. */
export async function salvarSegredoDoWebhook(autor: Autor, segredo: string, env: Ambiente = process.env): Promise<Resultado> {
  const chave = lerChave(env);
  if (!chave) return { erros: [SEM_CHAVE] };
  const atual = await prisma.integracao.findUnique({ where: { tipo: "EVOLUTION" } });
  if (!atual) return { erros: ["Salve a configuração da Evolution antes de configurar o webhook."] };
  await prisma.$transaction([
    prisma.integracao.update({ where: { tipo: "EVOLUTION" }, data: { webhookSegredoCifrado: cifrar(segredo, chave), webhookConfiguradoEm: new Date(), atualizadoPorId: autor.id } }),
    prisma.eventoAuditoria.createMany({ data: eventosDoSegredo("EVOLUTION", autor, "webhook", atual.webhookSegredoCifrado !== null) }),
  ]);
  return { erros: [] };
}

/** Evento connection.update da Evolution: open, close ou connecting. Sem configuração na tela, não guarda. */
export async function registrarEstadoDaConexao(estado: string, quando: Date = new Date()) {
  await prisma.integracao.updateMany({ where: { tipo: "EVOLUTION" }, data: { estadoConexao: estado.slice(0, 40), estadoConexaoEm: quando } });
}
