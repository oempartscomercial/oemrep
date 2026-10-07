"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** No celular fica fechado atrás de um botão (a tela vira fila de aprovar e responder); no desktop aparece sempre. */
export function RecolhivelNoCelular({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="flex h-11 items-center justify-between rounded-lg border bg-card px-4 text-sm font-medium lg:hidden"
      >
        {aberto ? `Esconder ${titulo}` : `Ver ${titulo}`}
        <ChevronDown className={cn("size-4 transition-transform", aberto && "rotate-180")} />
      </button>
      <div className={cn("flex-col gap-4", aberto ? "flex" : "hidden", "lg:flex")}>{children}</div>
    </div>
  );
}
