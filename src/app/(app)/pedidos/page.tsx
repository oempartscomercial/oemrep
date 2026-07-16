import Link from "next/link";
import { Plus, Upload01 } from "@untitledui/icons";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosPermitidos } from "./queries";
import { filtrarPedidos, type FiltroPedido } from "@/domain/pedido/filtro";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { PedidosTabela, type PedidoLinha } from "./pedidos-tabela";
import { cx } from "@/utils/cx";

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
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroBruto } = await searchParams;
  const filtro: FiltroPedido = filtroBruto && isFiltroPedido(filtroBruto) ? filtroBruto : "EM_ANDAMENTO";

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const pedidos = await buscarPedidosPermitidos(usuario);
  const filtrados = filtrarPedidos(pedidos, filtro);

  const linhas: PedidoLinha[] = filtrados.map((pedido) => ({
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
            <Button color="secondary" href="/pedidos/importar" iconLeading={Upload01}>
              Importar Excel
            </Button>
            <Button color="primary" href="/pedidos/novo" iconLeading={Plus}>
              Novo pedido
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-1 border-b border-secondary pb-3">
        {ABAS.map((aba) => (
          <Link
            key={aba.valor}
            href={`/pedidos?filtro=${aba.valor}`}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filtro === aba.valor ? "bg-brand-solid text-white" : "text-tertiary hover:bg-primary_hover",
            )}
          >
            {aba.rotulo}
          </Link>
        ))}
      </div>

      <PedidosTabela pedidos={linhas} />
    </PageContainer>
  );
}
