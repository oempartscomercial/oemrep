import { PageContainer } from "@/components/layouts/page-container";
import { Button } from "@/components/ui/buttons/button";

export default function RegistroNaoEncontrado() {
  return (
    <PageContainer>
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-lg font-semibold text-primary">Não encontramos este registro</h1>
        <p className="text-sm text-tertiary">Ele pode ter sido removido, ou o endereço está incompleto.</p>
        <Button color="primary" href="/">Voltar para o início</Button>
      </div>
    </PageContainer>
  );
}
