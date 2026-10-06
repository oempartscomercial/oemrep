import { PageContainer } from "@/components/layouts/page-container";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto enquanto a tela busca os dados no banco.
export default function Carregando() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </PageContainer>
  );
}
