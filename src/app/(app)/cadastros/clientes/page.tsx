import { Plus } from "@untitledui/icons";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { ClientesTabela, type ClienteLinha } from "../cadastros-tabelas";

// Lista de dados vivos do banco: sempre renderizar por requisição (nunca estática).
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nomeFantasia: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

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
        acoes={<Button color="primary" href="/cadastros/clientes/novo" iconLeading={Plus}>Novo cliente</Button>}
      />
      <ClientesTabela clientes={linhas} />
    </div>
  );
}
