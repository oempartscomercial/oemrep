import { Botao } from "./botao";

/** Fallback das telas sem sessão. Sempre oferece o caminho de volta ao login. */
export function SessaoExpirada() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-destructive">Sessão expirada. Faça login novamente.</p>
      <Botao variante="primario" href="/login">
        Ir para o login
      </Botao>
    </div>
  );
}
