import { AuthLayout } from "@/components/layouts/auth-layout";
import { Button } from "@/components/ui/buttons/button";

export default function NaoEncontrada() {
  return (
    <AuthLayout titulo="Página não encontrada" subtitulo="O endereço não existe ou o registro foi removido.">
      <Button color="primary" href="/" className="w-full">
        Voltar para o início
      </Button>
    </AuthLayout>
  );
}
