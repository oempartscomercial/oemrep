import { Plus } from "@untitledui/icons";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { UsuariosTabela, type UsuarioLinha } from "../cadastros-tabelas";

export default async function UsuariosPage() {
  const usuarioLogado = await obterUsuarioLogado();

  if (!usuarioLogado || usuarioLogado.perfil !== "ADMIN") {
    return <p className="text-sm text-error-primary">Acesso restrito a administradores.</p>;
  }

  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

  const linhas: UsuarioLinha[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    fabricas: u.fabricas.map((uf) => uf.fabrica.nome),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Usuários"
        descricao="Acesso e permissão por fábrica."
        acoes={<Button color="primary" href="/cadastros/usuarios/novo" iconLeading={<Plus />}>Novo usuário</Button>}
      />
      <UsuariosTabela usuarios={linhas} />
    </div>
  );
}
