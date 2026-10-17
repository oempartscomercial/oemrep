"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CampoSelect } from "@/components/patterns/campo";
import { COOKIE_FABRICA_FUNIL } from "@/domain/crm/fabrica-prospeccao";

const UM_ANO = 60 * 60 * 24 * 365;

/** Fábrica do dia no funil de prospecção. A escolha fica no navegador e volta na próxima visita. */
export function FiltroFabrica({ fabricas, atual }: { fabricas: { id: string; nome: string }[]; atual: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const opcoes = [{ id: "todas", label: "Todas as fábricas" }, ...fabricas.map((f) => ({ id: f.id, label: f.nome })), { id: "sem", label: "Sem fábrica" }];

  return (
    <CampoSelect
      className="w-52"
      ariaLabel="Fábrica do funil"
      opcoes={opcoes}
      valor={atual}
      desabilitado={pendente}
      aoMudar={(v) => {
        document.cookie = `${COOKIE_FABRICA_FUNIL}=${encodeURIComponent(v)}; path=/; max-age=${UM_ANO}; samesite=lax`;
        iniciar(() => router.refresh());
      }}
    />
  );
}
