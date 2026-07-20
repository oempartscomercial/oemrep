import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";

/**
 * Wordmark da OEM Representações. Texto simples até a logo oficial ser fornecida;
 * para usar a arte oficial, troque o conteúdo por <Image src="/oem-logo.png" .../>.
 */
export const OemLogo = (props: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div {...props} className={cx("flex flex-col leading-tight", props.className)}>
      <span className="text-sm font-bold tracking-tight text-primary">OEM</span>
      <span className="text-xs font-medium text-tertiary">Representações</span>
    </div>
  );
};
