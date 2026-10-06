import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Variante = "primario" | "secundario" | "ghost" | "destrutivo";
const VARIANTE: Record<Variante, ComponentProps<typeof Button>["variant"]> = {
  primario: "default",
  secundario: "outline",
  ghost: "ghost",
  destrutivo: "destructive",
};

type Props = Omit<ComponentProps<typeof Button>, "variant" | "asChild"> & {
  variante?: Variante;
  /** Ícone antes do texto (elemento já criado, ex.: <Plus />). */
  icone?: ReactNode;
  carregando?: boolean;
  /** Vira um link do Next com a aparência de botão. */
  href?: string;
};

/**
 * Botão do app. Centraliza variante, ícone, estado de carregamento e link,
 * para as telas não repetirem asChild/Link/Loader.
 */
export function Botao({ variante = "secundario", icone, carregando, href, disabled, children, ...props }: Props) {
  const conteudo = (
    <>
      {carregando ? <Loader2 className="animate-spin" /> : icone}
      {children}
    </>
  );
  if (href && !disabled) {
    return (
      <Button variant={VARIANTE[variante]} asChild {...props}>
        <Link href={href}>{conteudo}</Link>
      </Button>
    );
  }
  return (
    <Button variant={VARIANTE[variante]} disabled={disabled || carregando} {...props}>
      {conteudo}
    </Button>
  );
}
