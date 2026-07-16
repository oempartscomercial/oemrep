import type { HTMLAttributes } from "react";
import { Settings01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/**
 * Marca da OEM Representações: quadrado grafite com engrenagem vermelha (eco da logo
 * "OEM Parts") + wordmark. Stand-in em SVG/tokens; para usar a arte oficial, troque o
 * conteúdo por <Image src="/oem-logo.png" .../>.
 */
export const OemLogo = (props: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div {...props} className={cx("flex items-center gap-2.5", props.className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-solid">
        <Settings01 className="size-5 text-fg-error-primary" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight text-primary">OEM</span>
        <span className="text-xs font-medium text-tertiary">Representações</span>
      </span>
    </div>
  );
};

/** Versão só-ícone (para sidebar recolhida / favicon). */
export const OemLogoMinimal = (props: HTMLAttributes<HTMLDivElement>) => {
  return (
    <span {...props} className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-solid", props.className)}>
      <Settings01 className="size-5 text-fg-error-primary" />
    </span>
  );
};
