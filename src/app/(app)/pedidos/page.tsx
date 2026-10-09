import Link from "next/link";
import { Download } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosPermitidos } from "./queries";
import { filtrarPedidos, FILTROS_PEDIDO, type FiltroPedido } from "@/domain/pedido/filtro";
import { diasDesde, saldoAFaturar, valorDoPedido } from "@/domain/pedido/valor";
import { buscarPrazoPadraoSemNota } from "../alertas/queries";
import { formatarReais } from "@/domain/formato/moeda";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Botao } from "@/components/patterns/botao";
import { PedidosTabela, type PedidoLinha } from "./pedidos-tabela";
import { RegistrarPedidoMenu } from "./registrar-pedido-menu";
import { cn } from "@/lib/utils";
import { lerPagina, paginar, POR_PAGINA } from "@/domain/paginacao";
import { Paginacao } from "@/components/patterns/paginacao";

const ABAS: { valor: FiltroPedido; rotulo: string }[] = [
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "SEM_NOTA", rotulo: "Sem nota" },
  { valor: "CONCLUIDOS", rotulo: "Concluídos" },
  { valor: "ARQUIVADOS", rotulo: "Arquivados" },
  { valor: "TODOS", rotulo: "Todos" },
];

/** Abas operacionais mostram tudo agrupado por fábrica; as de consulta, lista paginada. */
const AGRUPADAS: FiltroPedido[] = ["EM_ANDAMENTO", "SEM_NOTA"];

function isFiltroPedido(valor: string): valor is FiltroPedido {
  return (FILTROS_PEDIDO as string[]).includes(valor);
}

const dataBr = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; pagina?: string; fabrica?: string }>;
}) {
  const { filtro: filtroBruto, pagina: paginaBruta, fabrica: fabricaFiltro } = await searchParams;
  const filtro: FiltroPedido = filtroBruto && isFiltroPedido(filtroBruto) ? filtroBruto : "EM_ANDAMENTO";

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const [todos, prazoPadrao] = await Promise.all([buscarPedidosPermitidos(usuario), buscarPrazoPadraoSemNota()]);
  const filtrados = filtrarPedidos(todos, filtro).filter((p) => !fabricaFiltro || p.fabricaId === fabricaFiltro);
  const agora = new Date();
  const operacional = AGRUPADAS.includes(filtro);

  const paraLinha = (pedido: (typeof filtrados)[number]): PedidoLinha => {
    const valores = {
      estado: pedido.estado,
      valorTotalDeclarado: pedido.valorTotalDeclarado,
      itens: pedido.itens.map((i) => ({ ...i, valorUnitario: Number(i.valorUnitario) })),
    };
    const dataRef = pedido.dataPedido ?? pedido.criadoEm;
    return {
      id: pedido.id,
      numero: pedido.semNumero ? "S/N" : pedido.numero ?? "—",
      numeroCliente: pedido.numeroCliente,
      fabrica: pedido.fabrica.nome,
      cliente: pedido.cliente.nomeFantasia,
      data: dataBr(dataRef),
      valor: operacional ? saldoAFaturar(valores) : valorDoPedido(valores),
      notas: pedido.notasFiscais.map((n) => n.notaFiscal),
      diasSemNota: pedido.estado === "SEM_NFE" ? diasDesde(dataRef, agora) : null,
      prazoDias: pedido.fabrica.slaDiasSemNota ?? prazoPadrao,
      rapidoSemItens: pedido.origem === "RAPIDO" && pedido.itens.length === 0,
      estado: pedido.estado,
    };
  };

  const acoes = (
    <>
      <Botao variante="secundario" className="h-11 md:h-8" href={`/api/export/pedidos?filtro=${filtro}`} icone={<Download />}>
        Exportar XLSX
      </Botao>
      <RegistrarPedidoMenu />
    </>
  );

  const abas = (
    <nav aria-label="Situação dos pedidos" className="flex gap-1 overflow-x-auto border-b">
      {ABAS.map((aba) => (
        <Link
          key={aba.valor}
          href={`/pedidos?filtro=${aba.valor}${fabricaFiltro ? `&fabrica=${fabricaFiltro}` : ""}`}
          aria-current={filtro === aba.valor ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
            filtro === aba.valor ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {aba.rotulo}
        </Link>
      ))}
    </nav>
  );

  if (!operacional) {
    const { itens: daPagina, pagina, total } = paginar(filtrados, lerPagina(paginaBruta));
    return (
      <PageContainer>
        <PageHeader titulo="Pedidos" descricao="Todos os pedidos das fábricas que você acompanha." acoes={acoes} />
        {abas}
        <PedidosTabela pedidos={daPagina.map(paraLinha)} rotuloValor="Valor" />
        <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} caminho="/pedidos" params={{ filtro, ...(fabricaFiltro ? { fabrica: fabricaFiltro } : {}) }} />
      </PageContainer>
    );
  }

  // Agrupado por fábrica, com quanto falta faturar em cada uma: a visão "pedidos recebidos sem
  // nota, por fábrica" que o Zé mantinha à mão.
  const grupos = new Map<string, { nome: string; linhas: PedidoLinha[] }>();
  for (const pedido of filtrados) {
    const g = grupos.get(pedido.fabricaId) ?? { nome: pedido.fabrica.nome, linhas: [] };
    g.linhas.push(paraLinha(pedido));
    grupos.set(pedido.fabricaId, g);
  }
  const ordenados = [...grupos.entries()]
    .map(([id, g]) => ({
      id,
      nome: g.nome,
      // Mais antigo sem nota primeiro: é o que precisa de cobrança.
      linhas: g.linhas.sort((a, b) => (b.diasSemNota ?? -1) - (a.diasSemNota ?? -1)),
      total: g.linhas.reduce((s, l) => s + l.valor, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const totalGeral = ordenados.reduce((s, g) => s + g.total, 0);

  return (
    <PageContainer>
      <PageHeader
        titulo="Pedidos"
        descricao={
          filtrados.length === 0
            ? "Nenhum pedido aguardando a fábrica."
            : `${filtrados.length} ${filtrados.length === 1 ? "pedido" : "pedidos"} · ${formatarReais(totalGeral)} a faturar`
        }
        acoes={acoes}
      />
      {abas}
      {fabricaFiltro && (
        <p className="text-sm text-muted-foreground">
          Mostrando uma fábrica.{" "}
          <Link href={`/pedidos?filtro=${filtro}`} className="underline underline-offset-4 hover:text-foreground">
            Ver todas
          </Link>
        </p>
      )}
      {ordenados.length === 0 ? (
        <PedidosTabela pedidos={[]} />
      ) : (
        ordenados.map((g) => (
          <section key={g.id} className="flex flex-col gap-2" aria-labelledby={`fabrica-${g.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`fabrica-${g.id}`} className="text-sm font-semibold">
                <Link href={`/pedidos?filtro=${filtro}&fabrica=${g.id}`} className="hover:underline">
                  {g.nome}
                </Link>
                <span className="ml-2 font-normal text-muted-foreground">
                  {g.linhas.length} {g.linhas.length === 1 ? "pedido" : "pedidos"}
                </span>
              </h2>
              <p className="text-sm tabular-nums">
                <span className="text-muted-foreground">a faturar </span>
                <span className="font-semibold">{formatarReais(g.total)}</span>
              </p>
            </div>
            <PedidosTabela pedidos={g.linhas} mostrarFabrica={false} />
          </section>
        ))
      )}
    </PageContainer>
  );
}
