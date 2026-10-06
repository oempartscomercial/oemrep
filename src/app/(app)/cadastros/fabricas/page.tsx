import { Download01, Plus } from "@untitledui/icons";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { FabricasTabela, type FabricaLinha } from "../cadastros-tabelas";

// Lista de dados vivos do banco: sempre renderizar por requisição (nunca estática).
export const dynamic = "force-dynamic";

export default async function FabricasPage() {
  const fabricas = await prisma.fabrica.findMany({ orderBy: { nome: "asc" } });
  const linhas: FabricaLinha[] = fabricas.map((f) => ({ id: f.id, nome: f.nome, cnpj: f.cnpj, ativo: f.ativo }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Fábricas"
        descricao="Fabricantes representados."
        acoes={
          <div className="flex gap-3">
            <Button color="secondary" href="/api/export/cadastros/fabricas" iconLeading={<Download01 />}>Exportar XLSX</Button>
            <Button color="primary" href="/cadastros/fabricas/novo" iconLeading={<Plus />}>Nova fábrica</Button>
          </div>
        }
      />
      <FabricasTabela fabricas={linhas} />
    </div>
  );
}
