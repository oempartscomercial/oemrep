"use client";

import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase";

/** "Não é você? Sair": encerra a sessão e volta ao login, que depois retorna para esta autorização. */
export function BotaoSair({ proximo }: { proximo: string }) {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await criarClienteNavegador().auth.signOut();
    window.location.assign(`/login?proximo=${encodeURIComponent(proximo)}`);
  }

  return (
    <button type="button" onClick={sair} disabled={saindo} className="font-medium text-foreground underline underline-offset-4 hover:no-underline disabled:opacity-50">
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
