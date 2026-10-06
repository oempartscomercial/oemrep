import { prisma } from "@/lib/prisma";
import { criarUsuario } from "../actions";
import { FormularioUsuario } from "../formulario-usuario";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage() {
  const fabricas = await prisma.fabrica.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  return <FormularioUsuario titulo="Novo usuário" acao={criarUsuario} fabricas={fabricas} />;
}
