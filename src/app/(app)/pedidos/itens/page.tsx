import { Download } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { filtroFabricasPermitidas } from "@/lib/authz";
import { lerFiltroItens } from "@/domain/pedido/filtro-itens";
import { buscarItens, ITENS_POR_PAGINA } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Paginacao } from "@/components/patterns/paginacao";
import { Botao } from "@/components/patterns/botao";
import { ItensFiltros } from "./itens-filtros";
import { ItensTabela, type ItemLinha } from "./itens-tabela";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ItensPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const filtro = lerFiltroItens(params);

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const permitidas = filtroFabricasPermitidas(usuario);
  const escopo = permitidas ? { id: { in: permitidas } } : {};
  const [{ itens, total }, fabricas, clientes] = await Promise.all([
    buscarItens(usuario, filtro),
    prisma.fabrica.findMany({ where: escopo, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.cliente.findMany({
      where: { pedidos: { some: permitidas ? { fabricaId: { in: permitidas } } : {} } },
      select: { id: true, nomeFantasia: true, cidade: true, uf: true },
      orderBy: { nomeFantasia: "asc" },
    }),
  ]);

  const linhas: ItemLinha[] = itens.map((i) => ({
    ...i,
    data: i.dataPedido.toLocaleDateString("pt-BR"),
    valorUnitario: reais.format(i.valorUnitario),
  }));
  const exportar = new URLSearchParams(
    Object.entries(params).filter(([chave, v]) => v && chave !== "pagina") as [string, string][],
  );

  return (
    <PageContainer>
      <PageHeader
        titulo="Itens de pedido"
        descricao="O que falta faturar, item a item, nas fábricas que você acompanha."
        acoes={
          <Botao variante="secundario" href={`/api/export/itens?${exportar.toString()}`} icone={<Download />}>
            Exportar XLSX
          </Botao>
        }
      />
      <ItensFiltros
        filtro={filtro}
        fabricas={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
        clientes={clientes.map((c) => ({ id: c.id, label: [c.nomeFantasia, [c.cidade, c.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") }))}
      />
      <ItensTabela itens={linhas} />
      <Paginacao pagina={filtro.pagina} total={total} porPagina={ITENS_POR_PAGINA} caminho="/pedidos/itens" params={params} />
    </PageContainer>
  );
}
