import type { ReactNode } from "react";
import { Label } from "@/components/ui/input/label";
import { HintText } from "@/components/ui/input/hint-text";

/**
 * Envolve um controle de formulário arbitrário com rótulo, texto de ajuda e mensagem
 * de erro (vermelho). Para inputs simples, prefira o próprio `Input`/`TextField`,
 * que já trazem label/hint embutidos.
 */
export function FormField({
  label,
  htmlFor,
  isRequired,
  dica,
  erro,
  children,
}: {
  label?: string;
  htmlFor?: string;
  isRequired?: boolean;
  dica?: string;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={htmlFor} isRequired={isRequired}>
          {label}
        </Label>
      )}
      {children}
      {erro ? (
        <HintText isInvalid>{erro}</HintText>
      ) : dica ? (
        <HintText>{dica}</HintText>
      ) : null}
    </div>
  );
}
