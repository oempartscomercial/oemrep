// Segredo salvo nunca volta para a tela (ADR-019): ela mostra só o final, para a pessoa
// reconhecer qual chave está lá. Segredo curto revela no máximo metade, até 4 caracteres.

export function finalDoSegredo(segredo: string): string {
  const s = segredo.trim();
  const quantos = Math.min(4, Math.floor(s.length / 2));
  return quantos > 0 ? s.slice(-quantos) : "";
}

export const mascararSegredo = (final: string) => `••••${final}`;
