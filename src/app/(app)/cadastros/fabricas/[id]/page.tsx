import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { editarFabrica, alterarAtivoFabrica } from "../actions";
import { FormularioFabrica } from "../formulario-fabrica";
import { AlternarAtivo } from "../../formulario";

export const dynamic = "force-dynamic";

export default async function EditarFabricaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fabrica = await prisma.fabrica.findUnique({ where: { id } });
  if (!fabrica) notFound();

  return (
    <div className="flex flex-col gap-4">
      <FormularioFabrica titulo="Editar fábrica" acao={editarFabrica.bind(null, id)} inicial={{ nome: fabrica.nome, cnpj: fabrica.cnpj }} />
      <AlternarAtivo
        ativo={fabrica.ativo}
        acao={alterarAtivoFabrica.bind(null, id)}
        efeitoAoDesativar="A fábrica some dos formulários de pedido e cadastro. Pedidos, notas e histórico continuam."
      />
    </div>
  );
}
