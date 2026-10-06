import { Download01, Plus } from "@untitledui/icons";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { UsuariosTabela, type UsuarioLinha } from "../cadastros-tabelas";

// Lista de dados vivos do banco: sempre renderizar por requisição (nunca estática).
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

  const linhas: UsuarioLinha[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    ativo: u.ativo,
    fabricas: u.fabricas.map((uf) => uf.fabrica.nome),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Usuários"
        descricao="Acesso e permissão por fábrica."
        acoes={
          <div className="flex gap-3">
            <Button color="secondary" href="/api/export/cadastros/usuarios" iconLeading={<Download01 />}>Exportar XLSX</Button>
            <Button color="primary" href="/cadastros/usuarios/novo" iconLeading={<Plus />}>Novo usuário</Button>
          </div>
        }
      />
      <UsuariosTabela usuarios={linhas} />
    </div>
  );
}
