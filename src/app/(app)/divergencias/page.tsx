import Link from "next/link";
import { Download01 } from "@untitledui/icons";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "./queries";
import { filtrarFila, lerSituacaoFila, resumirFila, type SituacaoFila } from "@/domain/chamado/fila";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Button } from "@/components/ui/buttons/button";
import { cx } from "@/utils/cx";
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

  const situacao = lerSituacaoFila((await searchParams).situacao);
  const chamados = await buscarChamadosPermitidos(usuario);
  const resumo = resumirFila(chamados);
  const linhas: ChamadoLinha[] = filtrarFila(chamados, situacao).map((chamado) => ({
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
          <Button color="secondary" href={`/api/export/divergencias?situacao=${situacao}`} iconLeading={<Download01 />}>
            Exportar XLSX
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="flex flex-col gap-2 rounded-xl bg-primary p-5 ring-1 ring-secondary">
            <span className="text-sm font-medium text-tertiary">{c.rotulo}</span>
            <p className={cx("text-display-xs font-semibold", c.alerta ? "text-error-primary" : "text-primary")}>{c.valor}</p>
            <p className="text-xs text-quaternary">{c.dica}</p>
          </div>
        ))}
      </div>

      <nav aria-label="Situação dos chamados" className="flex gap-1 rounded-lg bg-secondary_alt p-1 ring-1 ring-secondary sm:self-start">
        {ABAS.map((aba) => (
          <Link
            key={aba.id}
            href={aba.id === "ABERTOS" ? "/divergencias" : `/divergencias?situacao=${aba.id}`}
            aria-current={aba.id === situacao ? "page" : undefined}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-semibold",
              aba.id === situacao ? "bg-primary text-secondary shadow-xs ring-1 ring-primary" : "text-quaternary hover:text-secondary",
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
    </PageContainer>
  );
}
