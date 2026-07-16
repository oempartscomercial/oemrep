import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaAlerta } from "./queries";
import { pedidosSemNfeVencidos } from "@/domain/alerta/semNfe";
import { obterParametroNumero } from "@/lib/parametros";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { AlertasTabela, type AlertaLinha } from "./alertas-tabela";

export default async function AlertasPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const prazoDias = await obterParametroNumero("prazo_alerta_sem_nfe_dias", 7);
  const pedidos = await buscarPedidosParaAlerta(usuario);
  const vencidos = pedidosSemNfeVencidos(pedidos, new Date(), prazoDias);

  const linhas: AlertaLinha[] = vencidos.map((a) => ({
    id: a.pedidoId,
    numero: a.numero,
    fabrica: a.fabrica,
    cliente: a.cliente,
    diasSemNfe: a.diasSemNfe,
  }));

  return (
    <PageContainer>
      <PageHeader titulo="Alertas" descricao={`Pedidos sem nota fiscal há mais de ${prazoDias} dias.`} />
      <AlertasTabela alertas={linhas} />
    </PageContainer>
  );
}
