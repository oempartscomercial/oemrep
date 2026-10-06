import { PageContainer } from "@/components/layouts/page-container";
import { Botao } from "@/components/patterns/botao";

export default function RegistroNaoEncontrado() {
  return (
    <PageContainer>
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Não encontramos este registro</h1>
        <p className="text-sm text-muted-foreground">Ele pode ter sido removido, ou o endereço está incompleto.</p>
        <Botao variante="primario" href="/">Voltar para o início</Botao>
      </div>
    </PageContainer>
  );
}
