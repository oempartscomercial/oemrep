import { prisma } from "./prisma";
import type { EventoAuditoriaInput } from "@/domain/auditoria/evento";

/**
 * Só o que `registrarAlteracoes` precisa do client — assim ela aceita tanto o `prisma`
 * global quanto o `tx` de dentro de um `$transaction`.
 */
type ClienteAuditoria = {
  eventoAuditoria: { createMany: (args: { data: EventoAuditoriaInput[] }) => Promise<unknown> };
};

/**
 * Regra 4 do CLAUDE.md: toda alteração em pedidos e NFes deixa rastro. Passe o `tx` de um
 * `$transaction` sempre que houver um: gravar a auditoria fora da transação da mutação
 * deixa o dado alterado e o rastro ausente se a conexão cair no meio.
 */
export async function registrarAlteracoes(
  eventos: EventoAuditoriaInput[],
  cliente: ClienteAuditoria = prisma,
): Promise<void> {
  if (eventos.length === 0) return;
  await cliente.eventoAuditoria.createMany({ data: eventos });
}
