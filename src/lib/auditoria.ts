import { prisma } from "./prisma";
import type { EventoAuditoriaInput } from "@/domain/auditoria/evento";

export async function registrarAlteracoes(eventos: EventoAuditoriaInput[]): Promise<void> {
  if (eventos.length === 0) return;
  await prisma.eventoAuditoria.createMany({ data: eventos });
}
