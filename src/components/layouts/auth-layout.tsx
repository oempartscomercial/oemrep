import type { ReactNode } from "react";
import { OemLogo } from "@/components/foundations/logo/oem-logo";

/**
 * Moldura das telas de autenticação (login): logo centralizada + cartão de conteúdo.
 */
export function AuthLayout({ children, titulo, subtitulo }: { children: ReactNode; titulo?: string; subtitulo?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-secondary px-4 py-12">
      <div className="flex w-full max-w-90 flex-col gap-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <OemLogo />
          {titulo && (
            <div className="flex flex-col gap-2">
              <h1 className="text-display-xs font-semibold text-primary">{titulo}</h1>
              {subtitulo && <p className="text-md text-tertiary">{subtitulo}</p>}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-primary p-6 shadow-sm ring-1 ring-secondary sm:p-8">{children}</div>
      </div>
    </div>
  );
}
