import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Wordmark da OEM Representações. Texto simples até a logo oficial ser fornecida;
 * para usar a arte oficial, troque o conteúdo por <Image src="/oem-logo.png" .../>.
 */
export const OemLogo = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={cn("flex items-center gap-2", className)}>
    <span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">O</span>
    <span className="flex flex-col leading-none">
      <span className="text-sm font-semibold tracking-tight">OEM</span>
      <span className="text-[10px] text-muted-foreground">Representações</span>
    </span>
  </div>
);
