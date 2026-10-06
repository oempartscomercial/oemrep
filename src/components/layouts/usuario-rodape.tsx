"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut01 } from "@untitledui/icons";
import { criarClienteNavegador } from "@/lib/supabase";
import { Button } from "@/components/ui/buttons/button";

const NOME_PERFIL = { ADMIN: "Administrador", ANALISTA: "Analista", OPERADOR: "Operador" } as const;

export type UsuarioRodapeProps = { nome: string; perfil: keyof typeof NOME_PERFIL };

/** Quem está logado e o botão de sair, no pé da sidebar. */
export function UsuarioRodape({ nome, perfil }: UsuarioRodapeProps) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await criarClienteNavegador().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-secondary pt-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-primary">{nome}</p>
        <p className="truncate text-sm text-tertiary">{NOME_PERFIL[perfil]}</p>
      </div>
      <Button color="tertiary" size="sm" iconLeading={LogOut01} isLoading={saindo} onClick={sair} aria-label="Sair">
        Sair
      </Button>
    </div>
  );
}
