import Link from "next/link";
import { Download } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarAlertas } from "./queries";
import { contarAlertas, DIAS_RAPIDO_SEM_ITENS, ROTULO_ALERTA, TIPOS_ALERTA, type TipoAlerta } from "@/domain/alerta/fila";
import { DIAS_NOTA_PARADA } from "@/domain/rastreio/parada";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Botao } from "@/components/patterns/botao";
import { cn } from "@/lib/utils";
import { AlertasTabela } from "./alertas-tabela";

function isTipo(valor: string | undefined): valor is TipoAlerta {
  return !!valor && (TIPOS_ALERTA as string[]).includes(valor);
}

export default async function AlertasPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const { tipo: tipoBruto } = await searchParams;
  const tipo = isTipo(tipoBruto) ? tipoBruto : null;
  const { alertas, prazoPadraoDias } = await buscarAlertas(usuario);
  const contagem = contarAlertas(alertas);
  const visiveis = tipo ? alertas.filter((a) => a.tipo === tipo) : alertas;

  const regra: Record<TipoAlerta, string> = {
    SEM_NOTA: `Pedido sem nota depois do prazo da fábrica (padrão: ${prazoPadraoDias} dias, cada fábrica pode ter o seu).`,
    NOTA_PARADA: `Nota em trânsito sem novidade da transportadora há ${DIAS_NOTA_PARADA} dias ou mais.`,
    SEM_RASTREIO: `Nota em trânsito há ${DIAS_NOTA_PARADA} dias ou mais numa transportadora que o sistema não consulta sozinho.`,
    RAPIDO_SEM_ITENS: `Pedido rápido registrado há ${DIAS_RAPIDO_SEM_ITENS} dias ou mais e ainda sem os itens.`,
    CHAMADO_CRITICO: "Divergência sem movimento além do prazo de resolução.",
  };

  const abas: { valor: TipoAlerta | null; rotulo: string; total: number }[] = [
    { valor: null, rotulo: "Todos", total: alertas.length },
    ...TIPOS_ALERTA.map((t) => ({ valor: t, rotulo: ROTULO_ALERTA[t].titulo, total: contagem[t] })),
  ];

  return (
    <PageContainer>
      <PageHeader
        titulo="Alertas"
        descricao={alertas.length === 0 ? "Nada pedindo ação agora." : "O que precisa de uma ação, do mais urgente para o menos."}
        acoes={<Botao variante="secundario" className="h-11 md:h-8" href="/api/export/alertas" icone={<Download />}>Exportar XLSX</Botao>}
      />
      <nav aria-label="Tipos de alerta" className="flex gap-1 overflow-x-auto border-b">
        {abas.map((aba) => (
          <Link
            key={aba.rotulo}
            href={aba.valor ? `/alertas?tipo=${aba.valor}` : "/alertas"}
            aria-current={tipo === aba.valor ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
              tipo === aba.valor ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
            {aba.total > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums">{aba.total}</span>}
          </Link>
        ))}
      </nav>
      {tipo && (
        <p className="text-sm text-muted-foreground">
          {regra[tipo]} <span className="text-foreground">{ROTULO_ALERTA[tipo].acao}.</span>
        </p>
      )}
      <AlertasTabela
        alertas={visiveis.map((a) => ({ ...a, acao: ROTULO_ALERTA[a.tipo].acao }))}
        vazio={tipo ? `Nenhum alerta deste tipo. ${regra[tipo]}` : "Nada pendente. Tudo em dia."}
      />
    </PageContainer>
  );
}
