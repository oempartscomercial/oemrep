import { PageContainer } from "@/components/layouts/page-container";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto do funil: cabeçalho, abas e colunas, no lugar certo desde o primeiro quadro.
export default function Carregando() {
  return (
    <PageContainer className="max-w-none">
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando o funil">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-64" />
      <div className="grid auto-cols-[86%] grid-flow-col gap-3 overflow-hidden sm:auto-cols-[minmax(16rem,1fr)]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </PageContainer>
  );
}
