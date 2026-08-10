import { Button } from "@/components/ui/buttons/button";

/**
 * Fallback das telas quando não há sessão. Sempre oferece o caminho de volta:
 * sem o botão, o usuário fica sem saída e precisa editar a URL na mão.
 */
export function SessaoExpirada() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      <Button color="primary" href="/login">
        Ir para o login
      </Button>
    </div>
  );
}
