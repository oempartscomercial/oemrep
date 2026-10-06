import { Download, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
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
    <>
      <PageHeader
        titulo="Usuários"
        descricao="Acesso e permissão por fábrica."
        acoes={
          <>
            <Botao href="/api/export/cadastros/usuarios" icone={<Download />}>Exportar XLSX</Botao>
            <Botao variante="primario" href="/cadastros/usuarios/novo" icone={<Plus />}>Novo usuário</Botao>
          </>
        }
      />
      <UsuariosTabela usuarios={linhas} />
    </>
  );
}
