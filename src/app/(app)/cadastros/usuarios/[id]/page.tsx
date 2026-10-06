import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { editarUsuario, alterarAtivoUsuario } from "../actions";
import { FormularioUsuario } from "../formulario-usuario";
import { AlternarAtivo } from "../../formulario";

export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [usuario, fabricas] = await Promise.all([
    prisma.usuario.findUnique({ where: { id }, include: { fabricas: true } }),
    prisma.fabrica.findMany({ select: { id: true, nome: true, ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!usuario) notFound();
  const fabricasIds = usuario.fabricas.map((f) => f.fabricaId);

  return (
    <div className="flex flex-col gap-4">
      <FormularioUsuario
        titulo="Editar usuário"
        acao={editarUsuario.bind(null, id)}
        fabricas={fabricas.filter((f) => f.ativo || fabricasIds.includes(f.id))}
        inicial={{ nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, fabricasIds }}
      />
      <AlternarAtivo
        ativo={usuario.ativo}
        acao={alterarAtivoUsuario.bind(null, id)}
        efeitoAoDesativar="A pessoa perde o acesso na hora, mesmo com a senha certa. O histórico dela continua."
      />
    </div>
  );
}
