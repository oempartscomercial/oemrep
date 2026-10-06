import Link from "next/link";
import { Download } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "./queries";
import { filtrarFila, lerSituacaoFila, resumirFila, type SituacaoFila } from "@/domain/chamado/fila";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Botao } from "@/components/patterns/botao";
import { cn } from "@/lib/utils";
import { lerPagina, paginar, POR_PAGINA } from "@/domain/paginacao";
import { Paginacao } from "@/components/patterns/paginacao";
import { ChamadosTabela, type ChamadoLinha } from "./chamados-tabela";

const ABAS: { id: SituacaoFila; rotulo: string }[] = [
  { id: "ABERTOS", rotulo: "Abertos" },
  { id: "RESOLVIDOS", rotulo: "Resolvidos" },
  { id: "TODOS", rotulo: "Todos" },
];

export default async function DivergenciasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const params = await searchParams;
  const situacao = lerSituacaoFila(params.situacao);
  const chamados = await buscarChamadosPermitidos(usuario);
  const resumo = resumirFila(chamados);
  const { itens: daPagina, pagina, total } = paginar(filtrarFila(chamados, situacao), lerPagina(params.pagina));
  const linhas: ChamadoLinha[] = daPagina.map((chamado) => ({
    id: chamado.id,
    nfe: chamado.notaFiscal.numero,
    motivo: chamado.motivo.nome,
    estado: chamado.estado,
    critico: chamado.critico,
    ultimaAtualizacao: chamado.ultimaAtualizacao.toISOString(),
  }));

  const cartoes = [
    { rotulo: "Abertos", valor: resumo.abertos, dica: "Ainda sem resolução", alerta: false },
    { rotulo: "Críticos", valor: resumo.criticos, dica: "Parados além do prazo", alerta: resumo.criticos > 0 },
    { rotulo: "Aguardando", valor: resumo.aguardando, dica: "Esperando retorno", alerta: false },
    { rotulo: "Resolvidos", valor: resumo.resolvidos, dica: "Encerrados", alerta: false },
  ];

  return (
    <PageContainer>
      <PageHeader
        titulo="Divergências"
        descricao="Chamados abertos a partir de notas fiscais. Os críticos aparecem primeiro."
        acoes={
          <Botao variante="secundario" href={`/api/export/divergencias?situacao=${situacao}`} icone={<Download />}>
            Exportar XLSX
          </Botao>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3">
            <span className="text-xs text-muted-foreground">{c.rotulo}</span>
            <p className={cn("text-2xl font-semibold tabular", c.alerta ? "text-destructive" : "text-foreground")}>{c.valor}</p>
            <p className="text-xs text-muted-foreground">{c.dica}</p>
          </div>
        ))}
      </div>

      <nav aria-label="Situação dos chamados" className="flex gap-1 border-b">
        {ABAS.map((aba) => (
          <Link
            key={aba.id}
            href={aba.id === "ABERTOS" ? "/divergencias" : `/divergencias?situacao=${aba.id}`}
            aria-current={aba.id === situacao ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              aba.id === situacao
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      <ChamadosTabela
        chamados={linhas}
        vazio={situacao === "RESOLVIDOS" ? "Nenhum chamado resolvido ainda." : "Nenhum chamado aberto. Tudo em dia."}
      />
      <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} caminho="/divergencias" params={{ situacao }} />
    </PageContainer>
  );
}
