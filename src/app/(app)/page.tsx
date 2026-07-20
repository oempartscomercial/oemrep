import Link from "next/link";
import { AlertTriangle, Bell01, Package, Truck01 } from "@untitledui/icons";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarResumoDashboard, buscarSerieMensal } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";

const FILA_MAX = 8;

export default async function DashboardPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const { kpis, fila } = await buscarResumoDashboard(usuario);

  const serie = await buscarSerieMensal(usuario);
  const serieMax = Math.max(1, ...serie.map((p) => Math.max(p.valorPedido, p.valorNfe)));
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const rotuloMes = (mes: string) => {
    const [ano, m] = mes.split("-");
    return `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(m)]}/${ano.slice(2)}`;
  };

  const cartoes = [
    { rotulo: "Pedidos ativos", valor: kpis.pedidosAtivos, icone: Package, dica: "Ainda não arquivados", alerta: false },
    { rotulo: "NFes em trânsito", valor: kpis.nfesTransito, icone: Truck01, dica: "Aguardando recebimento", alerta: false },
    { rotulo: "Divergências abertas", valor: kpis.divergenciasAbertas, icone: AlertTriangle, dica: "Chamados sem resolução", alerta: kpis.divergenciasAbertas > 0 },
    { rotulo: "Alertas (sem NFe)", valor: kpis.alertas, icone: Bell01, dica: "Pedidos fora do prazo", alerta: kpis.alertas > 0 },
  ];

  const filaVisivel = fila.slice(0, FILA_MAX);

  return (
    <PageContainer>
      <PageHeader titulo="Dashboard" descricao="Visão geral da operação de representação comercial." />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c) => {
          const Icone = c.icone;
          return (
            <div key={c.rotulo} className="flex flex-col gap-4 rounded-xl bg-primary p-5 ring-1 ring-secondary">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-tertiary">{c.rotulo}</span>
                <span className={c.alerta ? "text-fg-error-primary" : "text-fg-brand-primary"}>
                  <Icone className="size-5" />
                </span>
              </div>
              <p className="text-display-sm font-semibold text-primary">{c.valor}</p>
              <p className="text-xs text-quaternary">{c.dica}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-primary">Pedidos × NFes por mês</h2>
          {usuario.perfil === "ADMIN" && (
            <Link href="/historico/importar" className="text-sm text-brand-secondary hover:underline">
              Importar histórico
            </Link>
          )}
        </div>

        {serie.length === 0 ? (
          <p className="text-sm text-tertiary">Sem dados ainda. Importe o histórico ou registre pedidos e NFes.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {serie.map((p) => (
              <li key={p.mes} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-tertiary">{rotuloMes(p.mes)}</span>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs text-quaternary">Ped.</span>
                  <span className="h-3 rounded-full bg-fg-brand-primary" style={{ width: `${Math.max(2, (p.valorPedido / serieMax) * 100)}%` }} aria-hidden />
                  <span className="text-sm text-primary">{brl(p.valorPedido)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs text-quaternary">NFe</span>
                  <span className="h-3 rounded-full bg-fg-success-primary" style={{ width: `${Math.max(2, (p.valorNfe / serieMax) * 100)}%` }} aria-hidden />
                  <span className="text-sm text-primary">{brl(p.valorNfe)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-primary">Fila do dia</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/alertas" className="text-brand-secondary hover:underline">Ver alertas</Link>
            <Link href="/divergencias" className="text-brand-secondary hover:underline">Ver divergências</Link>
          </div>
        </div>

        {filaVisivel.length === 0 ? (
          <p className="text-sm text-tertiary">Nada pendente. Tudo em dia. 🎉</p>
        ) : (
          <ul className="flex flex-col divide-y divide-secondary">
            {filaVisivel.map((item) => (
              <li key={`${item.tipo}-${item.href}`}>
                <Link href={item.href} className="flex items-center gap-3 py-3 hover:bg-primary_hover">
                  <span className={item.tipo === "CRITICO" ? "text-fg-error-primary" : "text-fg-brand-primary"}>
                    {item.tipo === "CRITICO" ? <AlertTriangle className="size-4" /> : <Bell01 className="size-4" />}
                  </span>
                  <span className="flex-1 text-sm font-medium text-primary">{item.titulo}</span>
                  <span className="text-xs text-tertiary">{item.detalhe}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {fila.length > FILA_MAX && (
          <p className="text-xs text-quaternary">Mostrando os {FILA_MAX} itens mais urgentes de {fila.length}.</p>
        )}
      </div>
    </PageContainer>
  );
}
