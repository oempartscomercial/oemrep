import { Download01, Plus } from "@untitledui/icons";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { lerPagina, paginar, POR_PAGINA } from "@/domain/paginacao";
import { Paginacao } from "@/components/patterns/paginacao";
import { ClientesTabela, type ClienteLinha } from "../cadastros-tabelas";

// Lista de dados vivos do banco: sempre renderizar por requisição (nunca estática).
export const dynamic = "force-dynamic";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
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
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Clientes"
        descricao="Clientes atendidos (podem pertencer a várias fábricas)."
        acoes={
          <div className="flex gap-3">
            <Button color="secondary" href="/api/export/cadastros/clientes" iconLeading={<Download01 />}>Exportar XLSX</Button>
            <Button color="primary" href="/cadastros/clientes/novo" iconLeading={<Plus />}>Novo cliente</Button>
          </div>
        }
      />
      <ClientesTabela clientes={linhas} />
      <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} caminho="/cadastros/clientes" params={{}} />
    </div>
  );
}
