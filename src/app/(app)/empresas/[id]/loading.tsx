import { PageContainer } from "@/components/layouts/page-container";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto no formato da ficha enquanto o cabeçalho é buscado (os blocos têm o seu).
export default function Carregando() {
  return (
    <PageContainer className="max-w-[90rem] gap-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs" aria-busy="true" aria-label="Carregando a empresa">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-xl md:size-14" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </PageContainer>
  );
}
