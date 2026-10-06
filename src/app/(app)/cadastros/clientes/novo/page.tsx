import { prisma } from "@/lib/prisma";
import { criarCliente } from "../actions";
import { FormularioCliente } from "../formulario-cliente";

export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  const fabricas = await prisma.fabrica.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  return <FormularioCliente titulo="Novo cliente" acao={criarCliente} fabricas={fabricas} />;
}
