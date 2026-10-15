"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Corpo da ficha. No desktop: atividade no centro e a empresa (sobre, contatos, carteira,
 * pedidos) na lateral. No celular, as duas partes viram abas para não virar um rolo só.
 */
export function AbasDaFicha({ principal, lateral, rotuloLateral }: { principal: ReactNode; lateral: ReactNode; rotuloLateral: string }) {
  const [aba, setAba] = useState<"atividade" | "empresa">("atividade");
  const abas = [
    { id: "atividade" as const, rotulo: "Atividade" },
    { id: "empresa" as const, rotulo: rotuloLateral },
  ];
  return (
    <>
      <div role="tablist" aria-label="Partes da ficha" className="grid grid-cols-2 rounded-lg bg-ink-soft p-1 lg:hidden">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cn("h-10 rounded-md text-sm font-medium transition-colors", aba === a.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground")}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className={cn("flex min-w-0 flex-col gap-4", aba !== "atividade" && "max-lg:hidden")}>{principal}</div>
        <aside aria-label="Sobre a empresa" className={cn("flex min-w-0 flex-col gap-4", aba !== "empresa" && "max-lg:hidden")}>
          {lateral}
        </aside>
      </div>
    </>
  );
}
