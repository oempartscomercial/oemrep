"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Botao } from "@/components/patterns/botao";
import { criarOportunidade } from "./actions";
import type { Sugestao } from "@/domain/crm/oportunidade";

/** Fábricas que o cliente ainda não compra. É um fato do cadastro, não uma previsão de venda. */
export function Sugestoes({ sugestoes }: { sugestoes: Sugestao[] }) {
  const router = useRouter();
  const [criando, setCriando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(s: Sugestao) {
    const chave = `${s.clienteId}|${s.fabricaId}`;
    setCriando(chave);
    setErro(null);
    const r = await criarOportunidade({ clienteId: s.clienteId, fabricaId: s.fabricaId, tipo: "VENDER_FABRICA_NOVA" });
    setCriando(null);
    if (r.erros.length) return setErro(r.erros[0]);
    router.refresh();
  }

  if (sugestoes.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Ideias de expansão</h2>
        <p className="text-xs text-muted-foreground">Fábricas que o cliente ainda não compra, começando por quem mais pediu. Ninguém garante que vá comprar: é um ponto de partida para conversar.</p>
      </div>
      <ul className="divide-y">
        {sugestoes.map((s) => {
          const chave = `${s.clienteId}|${s.fabricaId}`;
          return (
            <li key={chave} className="flex items-center justify-between gap-3 px-4 py-2">
              <p className="min-w-0 text-sm">
                <span className="font-medium">{s.cliente}</span> → <span className="font-medium">{s.fabrica}</span>
                <span className="block truncate text-xs text-muted-foreground">Hoje compra {s.compra.join(", ")}</span>
              </p>
              <Botao size="sm" icone={<Plus />} carregando={criando === chave} onClick={() => criar(s)}>
                Criar
              </Botao>
            </li>
          );
        })}
      </ul>
      {erro && <p className="border-t px-4 py-2 text-sm text-destructive">{erro}</p>}
    </section>
  );
}
