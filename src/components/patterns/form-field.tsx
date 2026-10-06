import type { ReactNode } from "react";
import { Campo } from "./campo";

/** Envolve um controle arbitrário com rótulo, dica e erro. Mantido por compatibilidade: prefira `Campo`. */
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
    <Campo rotulo={label} htmlFor={htmlFor} obrigatorio={isRequired} dica={dica} erro={erro}>
      {children}
    </Campo>
  );
}
