import { PageContainer } from "@/components/layouts/page-container";

// Esqueleto enquanto a tela busca os dados no banco.
export default function Carregando() {
  return (
    <PageContainer>
      <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Carregando">
        <div className="h-8 w-56 rounded-md bg-secondary" />
        <div className="h-4 w-80 rounded-md bg-secondary" />
        <div className="h-64 rounded-xl bg-secondary" />
      </div>
    </PageContainer>
  );
}
