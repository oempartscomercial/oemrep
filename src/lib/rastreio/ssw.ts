// Cliente da WebAPI de rastreio por chave de DANFE do SSW (TMS usado por várias transportadoras
// regionais). Endpoint público, sem autenticação, limite observado/documentado de 20 req/s:
// o controle de taxa fica com quem chama.
//
// Formato observado (2026-10-09, com a chave real da TRANSUNI):
//   sucesso:      {"success": true, "message": "...", "documento": {"header": {...}, "tracking": [...]}}
//   não achou:    {"success": false, "message": "Nenhum documento localizado"}
//   chave ruim:   {"success": false, "message": "Chave da DANFE invalida."}  (também: "...diferente de 55.",
//                 "...deve possuir 44 digitos.")
// Os erros vêm com HTTP 200: quem decide é o campo `success`, não o status HTTP.
// Cada item de `tracking`: data_hora / data_hora_efetiva (ISO sem fuso, horário de Brasília),
// ocorrencia ("NOME (70)"), descricao (texto detalhado; às vezes traz "Previsao de entrega: dd/mm/yy."),
// cidade, filial, dominio, codigo_ssw (identificador interno, não usado aqui).
// O header traz remetente e destinatário, mas nenhum campo com o nome da transportadora.

import type { Ocorrencia } from "@/domain/rastreio/ocorrencia";

export const URL_TRACKING_SSW = "https://ssw.inf.br/api/trackingdanfe";
export const TIMEOUT_SSW_MS = 15_000;

export type ResultadoConsulta =
  | {
      ok: true;
      encontrado: boolean;
      ocorrencias: Ocorrencia[];
      previsaoEntrega: Date | null;
      transportadoraNome: string | null;
      bruto: unknown;
    }
  | { ok: false; erro: string; tentarDeNovo: boolean };

function falha(erro: string, tentarDeNovo: boolean): ResultadoConsulta {
  return { ok: false, erro, tentarDeNovo };
}

export async function consultarSsw(
  chave: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoConsulta> {
  const digitos = chave.replace(/\D/g, "");
  if (digitos.length !== 44) {
    return falha("A chave da NFe precisa ter 44 dígitos.", false);
  }

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_SSW_MS);
  try {
    const resposta = await fetchImpl(URL_TRACKING_SSW, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ chave_nfe: digitos }),
      signal: controle.signal,
    });
    if (resposta.status === 429 || resposta.status >= 500) {
      return falha(`A SSW respondeu HTTP ${resposta.status}.`, true);
    }
    if (!resposta.ok) {
      return falha(`A SSW recusou a consulta (HTTP ${resposta.status}).`, false);
    }
    return interpretarResposta(await resposta.text());
  } catch (erro) {
    const nome = (erro as { name?: unknown } | null)?.name;
    return nome === "AbortError"
      ? falha(`A SSW não respondeu em ${TIMEOUT_SSW_MS / 1000} segundos.`, true)
      : falha("Falha de conexão com a SSW.", true);
  } finally {
    clearTimeout(relogio);
  }
}

// Link para o rastreio público no site da SSW, para uso humano. Padrão observado no site, não
// documentado oficialmente: pode mudar sem aviso.
export function linkPublicoSsw(cnpjDestinatarioOuRemetente: string, numeroNota: string): string {
  const cnpj = cnpjDestinatarioOuRemetente.replace(/\D/g, "");
  const numero = numeroNota.replace(/\D/g, "");
  if (!cnpj || !numero) {
    throw new Error("linkPublicoSsw precisa de CNPJ e número da nota.");
  }
  return `https://ssw.inf.br/app/tracking/${cnpj}/${numero}`;
}

function interpretarResposta(texto: string): ResultadoConsulta {
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return falha("A SSW devolveu algo que não é JSON.", false);
  }
  if (!ehRegistro(corpo) || typeof corpo.success !== "boolean") {
    return falha("A SSW devolveu um formato inesperado.", false);
  }

  const mensagem = lerTexto(corpo.message) ?? "";
  if (!corpo.success) {
    if (semAcentos(mensagem).toLowerCase().includes("nenhum documento localizado")) {
      return {
        ok: true,
        encontrado: false,
        ocorrencias: [],
        previsaoEntrega: null,
        transportadoraNome: null,
        bruto: corpo,
      };
    }
    return falha(mensagem || "A SSW recusou a chave.", false);
  }

  const documento = corpo.documento;
  if (!ehRegistro(documento) || !Array.isArray(documento.tracking)) {
    return falha("A SSW não trouxe o bloco de rastreio.", false);
  }
  const registros = documento.tracking.filter(ehRegistro);

  return {
    ok: true,
    encontrado: true,
    ocorrencias: registros.map(paraOcorrencia),
    previsaoEntrega: extrairPrevisaoEntrega(registros),
    transportadoraNome: extrairTransportadora(corpo, documento),
    bruto: corpo,
  };
}

function paraOcorrencia(registro: Record<string, unknown>): Ocorrencia {
  // "DOCUMENTO DE TRANSPORTE EMITIDO (70)" -> descricao sem o código, codigo "70".
  const rotuloCompleto = lerTexto(registro.ocorrencia) ?? lerTexto(registro.descricao) ?? "";
  const codigo = /\((\d+)\)\s*$/.exec(rotuloCompleto)?.[1] ?? null;
  return {
    data: parseDataSsw(lerTexto(registro.data_hora_efetiva) ?? lerTexto(registro.data_hora)),
    descricao: rotuloCompleto.replace(/\s*\(\d+\)\s*$/, "").trim(),
    local: lerTexto(registro.cidade),
    codigo,
  };
}

// Datas do SSW são de Brasília (UTC-3 fixo, sem horário de verão desde 2019).
function parseDataSsw(texto: string | null): Date | null {
  if (!texto) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texto);
  if (iso) {
    return montarData(+iso[1], +iso[2], +iso[3], +iso[4], +iso[5], +(iso[6] ?? 0));
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(texto);
  if (br) {
    return montarData(+br[3], +br[2], +br[1], +(br[4] ?? 0), +(br[5] ?? 0), +(br[6] ?? 0));
  }
  return null;
}

function montarData(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  segundo: number,
): Date | null {
  // Dia 0 do mês seguinte = último dia do mês `mes` (1 a 12).
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes) return null;
  if (hora > 23 || minuto > 59 || segundo > 59) return null;
  // Brasília = UTC-3, então o UTC é o horário local + 3.
  return new Date(Date.UTC(ano, mes - 1, dia, hora + 3, minuto, segundo));
}

// "Previsao de entrega: 23/10/26." aparece no texto detalhado de algumas ocorrências.
// Vale a última menção, que é a previsão mais recente.
function extrairPrevisaoEntrega(registros: Record<string, unknown>[]): Date | null {
  const padrao = /previsao de entrega:?\s*(\d{2})\/(\d{2})\/(\d{2}|\d{4})/i;
  let previsao: Date | null = null;
  for (const registro of registros) {
    const texto = semAcentos(`${lerTexto(registro.ocorrencia) ?? ""} ${lerTexto(registro.descricao) ?? ""}`);
    const m = padrao.exec(texto);
    if (!m) continue;
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const data = montarData(ano, Number(m[2]), Number(m[1]), 0, 0, 0);
    if (data) previsao = data;
  }
  return previsao;
}

// Não há nome de transportadora no formato observado. Aceita o campo se algum dia aparecer.
function extrairTransportadora(
  corpo: Record<string, unknown>,
  documento: Record<string, unknown>,
): string | null {
  const header: Record<string, unknown> = ehRegistro(documento.header) ? documento.header : {};
  return (
    lerTexto(documento.transportadora) ??
    lerTexto(header.transportadora) ??
    lerTexto(corpo.transportadora)
  );
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function lerTexto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

function semAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
