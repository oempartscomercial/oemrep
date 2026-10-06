"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { criarClienteNavegador } from "@/lib/supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const NOME_PERFIL = { ADMIN: "Administrador", ANALISTA: "Analista", OPERADOR: "Operador" } as const;

export type UsuarioRodapeProps = { nome: string; perfil: keyof typeof NOME_PERFIL };

/** Quem está logado e o botão de sair, no pé do menu lateral. */
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
    <div className="flex items-center gap-2 px-1">
      <Avatar className="size-7">
        <AvatarFallback className="text-xs">{nome.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{nome}</p>
        <p className="truncate text-xs text-muted-foreground">{NOME_PERFIL[perfil]}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={sair} disabled={saindo} aria-label="Sair" title="Sair">
        <LogOut />
      </Button>
    </div>
  );
}
