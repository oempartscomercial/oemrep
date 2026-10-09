import Link from "next/link";
import { Download } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarNotasFiscaisPermitidas } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Botao } from "@/components/patterns/botao";
import { lerPagina, paginar, POR_PAGINA } from "@/domain/paginacao";
import { Paginacao } from "@/components/patterns/paginacao";
import { emTransito, notaParada } from "@/domain/rastreio/parada";
import { cn } from "@/lib/utils";
import { RastreioTabela, type NotaRastreioLinha } from "./rastreio-tabela";
import { BotaoAtualizarRastreio } from "./botao-atualizar";

// "Atualizar todas" consulta uma nota por vez na transportadora.
export const maxDuration = 120;

type Filtro = "TRANSITO" | "PARADAS" | "RECEBIDAS" | "TODAS";
const ABAS: { valor: Filtro; rotulo: string }[] = [
  { valor: "TRANSITO", rotulo: "Em trânsito" },
  { valor: "PARADAS", rotulo: "Paradas" },
  { valor: "RECEBIDAS", rotulo: "Recebidas" },
  { valor: "TODAS", rotulo: "Todas" },
];

const fmtData = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null);
const fmtDataHora = (d: Date | null) =>
  d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

export default async function RastreioPage({ searchParams }: { searchParams: Promise<{ pagina?: string; filtro?: string }> }) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const params = await searchParams;
  const filtro: Filtro = ABAS.some((a) => a.valor === params.filtro) ? (params.filtro as Filtro) : "TRANSITO";
  const agora = new Date();
  const todas = await buscarNotasFiscaisPermitidas(usuario);
  const paradas = todas.filter((n) => notaParada(n, agora));
  const filtradas =
    filtro === "TRANSITO" ? todas.filter((n) => emTransito(n.status))
    : filtro === "PARADAS" ? paradas
    : filtro === "RECEBIDAS" ? todas.filter((n) => n.status === "RECEBIDA")
    : todas;

  const { itens: notas, pagina, total } = paginar(filtradas, lerPagina(params.pagina));
  const linhas: NotaRastreioLinha[] = notas.map((nota) => ({
    id: nota.id,
    numero: nota.numero,
    cliente: [...new Set(nota.pedidos.map((p) => p.pedido.cliente.nomeFantasia))].join(", ") || "—",
    pedidos: nota.pedidos.map((p) => (p.pedido.semNumero ? "S/N" : p.pedido.numero ?? "S/N")).join(", "),
    transportadora: nota.transportadora?.nome ?? null,
    semRastreioAutomatico: nota.transportadora?.metodo === "MANUAL" || nota.transportadora?.metodo === "NAO_MAPEADA",
    status: nota.status,
    previsao: fmtData(nota.previsaoEntrega),
    ultimaOcorrencia: nota.ultimaOcorrencia,
    ultimaOcorrenciaEm: fmtDataHora(nota.ultimaOcorrenciaEm),
    atualizado: fmtDataHora(nota.rastreioAtualizadoEm),
    parada: notaParada(nota, agora),
  }));

  return (
    <PageContainer>
      <PageHeader
        titulo="Rastreio de NFe"
        descricao="Onde está cada nota. As transportadoras são consultadas todo dia de manhã."
        acoes={
          <>
            <Botao variante="secundario" className="h-11 md:h-8" href="/api/export/rastreio" icone={<Download />}>Exportar XLSX</Botao>
            <BotaoAtualizarRastreio rotulo="Atualizar todas" />
          </>
        }
      />
      <nav aria-label="Situação das notas" className="flex gap-1 overflow-x-auto border-b">
        {ABAS.map((aba) => (
          <Link
            key={aba.valor}
            href={`/rastreio?filtro=${aba.valor}`}
            aria-current={filtro === aba.valor ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
              filtro === aba.valor ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
            {aba.valor === "PARADAS" && paradas.length > 0 && (
              <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 text-xs font-medium text-warning">{paradas.length}</span>
            )}
          </Link>
        ))}
      </nav>
      <RastreioTabela notas={linhas} />
      <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} caminho="/rastreio" params={{ filtro }} />
    </PageContainer>
  );
}
