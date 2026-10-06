import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Container padrão de página: largura máxima e respiros consistentes. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 md:py-6", className)}>{children}</div>;
}
