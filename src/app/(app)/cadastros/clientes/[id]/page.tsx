import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { editarCliente } from "../actions";
import { FormularioCliente } from "../formulario-cliente";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cliente, fabricas] = await Promise.all([
    prisma.cliente.findUnique({ where: { id }, include: { fabricas: true } }),
    prisma.fabrica.findMany({ select: { id: true, nome: true, ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!cliente) notFound();
  const fabricasIds = cliente.fabricas.map((f) => f.fabricaId);

  return (
    <FormularioCliente
      titulo="Editar cliente"
      acao={editarCliente.bind(null, id)}
      // Fábrica inativa só aparece se o cliente já estiver vinculado a ela.
      fabricas={fabricas.filter((f) => f.ativo || fabricasIds.includes(f.id))}
      inicial={{ nomeFantasia: cliente.nomeFantasia, cnpj: cliente.cnpj, fabricasIds }}
    />
  );
}
