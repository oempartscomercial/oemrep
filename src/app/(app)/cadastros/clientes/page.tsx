import { Download, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { lerPagina, paginar, POR_PAGINA } from "@/domain/paginacao";
import { Paginacao } from "@/components/patterns/paginacao";
import { ClientesTabela, type ClienteLinha } from "../cadastros-tabelas";

// Lista de dados vivos do banco: sempre renderizar por requisição (nunca estática).
export const dynamic = "force-dynamic";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const usuarioLogado = await obterUsuarioLogado();
  if (!usuarioLogado || usuarioLogado.perfil !== "ADMIN") {
    return <p className="text-sm text-destructive">Acesso restrito a administradores.</p>;
  }

  const todos = await prisma.cliente.findMany({
    orderBy: { nomeFantasia: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

  const { itens: clientes, pagina, total } = paginar(todos, lerPagina((await searchParams).pagina));
  const linhas: ClienteLinha[] = clientes.map((c) => ({
    id: c.id,
    nomeFantasia: c.nomeFantasia,
    cnpj: c.cnpj,
    fabricas: c.fabricas.map((cf) => cf.fabrica.nome),
  }));

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="Clientes atendidos (podem pertencer a várias fábricas)."
        acoes={
          <>
            <Botao href="/api/export/cadastros/clientes" icone={<Download />}>Exportar XLSX</Botao>
            <Botao variante="primario" href="/cadastros/clientes/novo" icone={<Plus />}>Novo cliente</Botao>
          </>
        }
      />
      <ClientesTabela clientes={linhas} />
      <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} caminho="/cadastros/clientes" params={{}} />
    </>
  );
}
