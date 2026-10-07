import { AppShell } from "@/components/layouts/app-shell";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { contarPendenciasDeConversas } from "./conversas/queries";

// Selo do menu é acessório: se a contagem falhar, a página segue sem ele.
async function pendenciasDeConversasDoMenu(usuario: Awaited<ReturnType<typeof obterUsuarioLogado>>) {
  if (!usuario || !podeVerCrm(usuario)) return null;
  try {
    return (await contarPendenciasDeConversas()).total;
  } catch (erro) {
    console.error("Selo de Conversas: contagem falhou", erro);
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioLogado();
  const pendenciasConversas = await pendenciasDeConversasDoMenu(usuario);
  return (
    <AppShell usuario={usuario ? { nome: usuario.nome, perfil: usuario.perfil } : null} pendenciasConversas={pendenciasConversas}>
      {children}
    </AppShell>
  );
}
