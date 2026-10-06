import { AuthLayout } from "@/components/layouts/auth-layout";
import { Botao } from "@/components/patterns/botao";

export default function NaoEncontrada() {
  return (
    <AuthLayout titulo="Página não encontrada" subtitulo="O endereço não existe ou o registro foi removido.">
      <Botao variante="primario" href="/" className="w-full">
        Voltar para o início
      </Botao>
    </AuthLayout>
  );
}
