import { AlertTriangle, FileCheck02, Package, Truck01 } from "@untitledui/icons";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";

const METRICAS = [
  { rotulo: "Pedidos ativos", icone: Package, dica: "Pedidos ainda não arquivados" },
  { rotulo: "NFes em trânsito", icone: Truck01, dica: "Aguardando recebimento" },
  { rotulo: "Conferências pendentes", icone: FileCheck02, dica: "NFes a conferir" },
  { rotulo: "Divergências abertas", icone: AlertTriangle, dica: "Chamados sem resolução", alerta: true },
];

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader titulo="Dashboard" descricao="Visão geral da operação de representação comercial." />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {METRICAS.map((m) => {
          const Icone = m.icone;
          return (
            <div key={m.rotulo} className="flex flex-col gap-4 rounded-xl bg-primary p-5 ring-1 ring-secondary">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-tertiary">{m.rotulo}</span>
                <span className={m.alerta ? "text-fg-error-primary" : "text-fg-brand-primary"}>
                  <Icone className="size-5" />
                </span>
              </div>
              <p className="text-display-sm font-semibold text-primary">—</p>
              <p className="text-xs text-quaternary">{m.dica}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <h2 className="text-lg font-semibold text-primary">Em construção</h2>
        <p className="mt-1 text-sm text-tertiary">
          Os indicadores e listas do painel chegam nos próximos épicos. A navegação lateral já dá acesso a
          Pedidos, Conferência de NFe, Rastreio e Cadastros.
        </p>
      </div>
    </PageContainer>
  );
}
