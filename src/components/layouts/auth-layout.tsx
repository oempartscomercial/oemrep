import type { ReactNode } from "react";
import { OemLogo } from "@/components/foundations/logo/oem-logo";

/** Moldura das telas de autenticação: logo centralizada + cartão de conteúdo. */
export function AuthLayout({ children, titulo, subtitulo }: { children: ReactNode; titulo?: string; subtitulo?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <OemLogo />
          {titulo && (
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
              {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-xs">{children}</div>
      </div>
    </div>
  );
}
