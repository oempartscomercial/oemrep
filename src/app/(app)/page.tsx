import { Suspense } from "react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { formatarDiaComSemana, hojeEmSaoPaulo } from "@/domain/crm/prazo";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Fila, Grafico, GraficoCarregando, Kpis, KpisCarregando, ListaCarregando, PorFabrica, PorFabricaCarregando, Tarefas } from "./_inicio/blocos";

export default async function InicioPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }
  const data = formatarDiaComSemana(hojeEmSaoPaulo());
  const crm = podeVerCrm(usuario);

  // Cada bloco vem em streaming: o topo aparece na hora e cada parte chega quando fica pronta.
  return (
    <PageContainer>
      <PageHeader titulo={`Olá, ${usuario.nome.split(" ")[0]}`} descricao={data[0].toUpperCase() + data.slice(1)} />
      <Suspense fallback={<KpisCarregando />}>
        <Kpis usuario={usuario} />
      </Suspense>
      <div className={crm ? "grid grid-cols-1 items-start gap-4 lg:grid-cols-2" : "flex flex-col"}>
        {crm && (
          <Suspense fallback={<ListaCarregando />}>
            <Tarefas usuario={usuario} />
          </Suspense>
        )}
        <Suspense fallback={<ListaCarregando />}>
          <Fila usuario={usuario} />
        </Suspense>
      </div>
      <Suspense fallback={<GraficoCarregando />}>
        <Grafico usuario={usuario} />
      </Suspense>
      <Suspense fallback={<PorFabricaCarregando />}>
        <PorFabrica usuario={usuario} />
      </Suspense>
    </PageContainer>
  );
}
