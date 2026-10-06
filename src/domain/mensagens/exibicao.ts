import type { TipoMensagem } from "./evolution";

// Como uma mensagem aparece na tela. Aviso = o que não é texto (áudio, imagem...).
export function descreverMensagem(m: { tipo: TipoMensagem; texto: string | null }): { aviso: string | null; texto: string | null } {
  switch (m.tipo) {
    case "TEXTO":
      return { aviso: null, texto: m.texto };
    case "AUDIO":
      return { aviso: "Áudio (ainda sem transcrição)", texto: m.texto };
    case "IMAGEM":
      return { aviso: "Imagem", texto: m.texto };
    case "VIDEO":
      return { aviso: "Vídeo", texto: m.texto };
    case "DOCUMENTO":
      return { aviso: "Documento", texto: m.texto };
    case "OUTRO":
      return { aviso: "Mensagem de outro tipo (figurinha, localização…)", texto: m.texto };
  }
}

const FUSO = "America/Sao_Paulo";

/** "AAAA-MM-DD" no fuso de São Paulo. */
export const diaEmSaoPaulo = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: FUSO });

export const formatarHora = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false });

export function agruparPorDia<T extends { ocorridoEm: Date }>(mensagens: T[]): { dia: string; mensagens: T[] }[] {
  const ordenadas = [...mensagens].sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime());
  const grupos: { dia: string; mensagens: T[] }[] = [];
  for (const m of ordenadas) {
    const dia = diaEmSaoPaulo(m.ocorridoEm);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.mensagens.push(m);
    else grupos.push({ dia, mensagens: [m] });
  }
  return grupos;
}

/** +5547999998888 → (47) 99999-8888. Número de fora do Brasil fica como está. */
export function formatarNumero(e164: string): string {
  const br = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return br ? `(${br[1]}) ${br[2]}-${br[3]}` : e164;
}
