import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosPermitidos } from "./queries";
import { filtrarPedidos, type FiltroPedido } from "@/domain/pedido/filtro";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Botao } from "@/components/patterns/botao";
import { PedidosTabela, type PedidoLinha } from "./pedidos-tabela";
import { cn } from "@/lib/utils";
import { lerPagina, paginar, POR_PAGINA } from "@/domain/paginacao";
import { Paginacao } from "@/components/patterns/paginacao";


const ABAS: { valor: FiltroPedido; rotulo: string }[] = [
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "CONCLUIDOS", rotulo: "Concluídos" },
  { valor: "ARQUIVADOS", rotulo: "Arquivados" },
  { valor: "TODOS", rotulo: "Todos" },
];

function isFiltroPedido(valor: string): valor is FiltroPedido {
  return ABAS.some((aba) => aba.valor === valor);
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; pagina?: string }>;
}) {
  const { filtro: filtroBruto, pagina: paginaBruta } = await searchParams;
  const filtro: FiltroPedido = filtroBruto && isFiltroPedido(filtroBruto) ? filtroBruto : "EM_ANDAMENTO";

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const pedidos = await buscarPedidosPermitidos(usuario);
  const { itens: daPagina, pagina, total } = paginar(filtrarPedidos(pedidos, filtro), lerPagina(paginaBruta));

  const linhas: PedidoLinha[] = daPagina.map((pedido) => ({
    id: pedido.id,
    numero: pedido.semNumero ? "S/N" : pedido.numero ?? "—",
    fabrica: pedido.fabrica.nome,
    cliente: pedido.cliente.nomeFantasia,
    qtdItens: pedido.itens.length,
    estado: pedido.estado,
  }));

  return (
    <PageContainer>
      <PageHeader
        titulo="Pedidos"
        descricao="Todos os pedidos das fábricas que você acompanha."
        acoes={
          <>
            <Botao variante="secundario" href={`/api/export/pedidos?filtro=${filtro}`} icone={<Download />}>
              Exportar XLSX
            </Botao>
            <Botao variante="secundario" href="/pedidos/importar" icone={<Upload />}>
              Importar Excel
            </Botao>
            <Botao variante="primario" href="/pedidos/novo" icone={<Plus />}>
              Novo pedido
            </Botao>
          </>
        }
      />

      <nav aria-label="Situação dos pedidos" className="flex gap-1 border-b">
        {ABAS.map((aba) => (
          <Link
            key={aba.valor}
            href={`/pedidos?filtro=${aba.valor}`}
            aria-current={filtro === aba.valor ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              filtro === aba.valor
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      <PedidosTabela pedidos={linhas} />
      <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} caminho="/pedidos" params={{ filtro }} />
    </PageContainer>
  );
}
