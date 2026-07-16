import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * Container padrão de página: largura máxima e respiros consistentes.
 */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto flex w-full max-w-container flex-col gap-6 px-4 py-6 md:px-8 md:py-8", className)}>{children}</div>;
}
