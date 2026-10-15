import { Suspense } from "react";
import { AppShell } from "@/components/layouts/app-shell";
import { SeloConversasCabecalho, SeloConversasMenu } from "@/components/layouts/selo-conversas";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioLogado();
  // O selo de Conversas chega depois, em streaming; sem CRM (OPERADOR) não há selo.
  const comSelo = usuario !== null && podeVerCrm(usuario);
  return (
    <AppShell
      usuario={usuario ? { nome: usuario.nome, perfil: usuario.perfil } : null}
      seloConversas={comSelo ? <Suspense fallback={null}><SeloConversasMenu /></Suspense> : null}
      seloCabecalho={comSelo ? <Suspense fallback={null}><SeloConversasCabecalho /></Suspense> : null}
    >
      {children}
    </AppShell>
  );
}
