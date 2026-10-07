import { Download, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { FabricasTabela, type FabricaLinha } from "../cadastros-tabelas";

// Lista de dados vivos do banco: sempre renderizar por requisição (nunca estática).
export const dynamic = "force-dynamic";

export default async function FabricasPage() {
  const usuarioLogado = await obterUsuarioLogado();

  if (!usuarioLogado || usuarioLogado.perfil !== "ADMIN") {
    return <p className="text-sm text-destructive">Acesso restrito a administradores.</p>;
  }

  const fabricas = await prisma.fabrica.findMany({ orderBy: { nome: "asc" } });
  const linhas: FabricaLinha[] = fabricas.map((f) => ({ id: f.id, nome: f.nome, cnpj: f.cnpj, ativo: f.ativo }));

  return (
    <>
      <PageHeader
        titulo="Fábricas"
        descricao="Fabricantes representados."
        acoes={
          <>
            <Botao href="/api/export/cadastros/fabricas" icone={<Download />}>Exportar XLSX</Botao>
            <Botao variante="primario" href="/cadastros/fabricas/novo" icone={<Plus />}>Nova fábrica</Botao>
          </>
        }
      />
      <FabricasTabela fabricas={linhas} />
    </>
  );
}
