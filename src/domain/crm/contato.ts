import { normalizarTelefone } from "@/domain/mensagens/telefone";
import { formatarNumero } from "@/domain/mensagens/exibicao";

// Por onde se fala com a pessoa ou a empresa. Os valores são os do enum CanalContato.
export const CANAIS_CONTATO = [
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "TELEFONE", label: "Telefone" },
  { id: "EMAIL", label: "E-mail" },
  { id: "LINKEDIN", label: "LinkedIn" },
  { id: "OUTRO", label: "Outro" },
] as const;

export type ResultadoDoContato = { erros: string[]; valorNormalizado?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** WhatsApp e telefone são números; o resto é texto (e-mail, link, anotação). */
export function ehCanalTelefone(canal: string): boolean {
  return canal === "WHATSAPP" || canal === "TELEFONE";
}

/** O número em E.164 de um contato de telefone, ou null. Nunca completa nem adivinha. */
export function numeroDoContato(canal: string, valor: string): string | null {
  return ehCanalTelefone(canal) ? normalizarTelefone(valor) : null;
}

/**
 * Regras de um contato antes de gravar. Telefone vira o formato legível (47) 99999-8888;
 * e-mail é conferido de forma simples; fonte é obrigatória para toda a base.
 */
export function validarContato(entrada: { canal: string; valor: string; fonte: string }): ResultadoDoContato {
  const erros: string[] = [];
  const canal = entrada.canal;
  const valor = entrada.valor.trim();
  let valorNormalizado: string | undefined;

  if (!CANAIS_CONTATO.some((c) => c.id === canal)) erros.push("Escolha por onde é esse contato.");
  if (!valor) erros.push("Informe o número ou o e-mail deste contato.");
  if (!entrada.fonte.trim()) erros.push("Diga de onde veio esse contato (ex.: Indicação do João).");

  if (valor && ehCanalTelefone(canal)) {
    const e164 = normalizarTelefone(valor);
    if (e164) valorNormalizado = formatarNumero(e164);
    else erros.push("Telefone inválido. Use DDD + número.");
  } else if (valor && canal === "EMAIL") {
    if (EMAIL.test(valor)) valorNormalizado = valor;
    else erros.push("E-mail inválido. Ex.: nome@empresa.com.br");
  } else if (valor) {
    valorNormalizado = valor;
  }

  return erros.length > 0 ? { erros } : { erros, valorNormalizado };
}

/** Chave para ver se dois contatos da mesma empresa são o mesmo (canal + valor normalizado). */
export function chaveDuplicidade(canal: string, valor: string): string {
  const texto = valor.trim();
  if (ehCanalTelefone(canal)) return normalizarTelefone(texto) ?? texto.toLowerCase();
  return texto.toLowerCase();
}
