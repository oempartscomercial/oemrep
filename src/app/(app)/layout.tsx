import { AppShell } from "@/components/layouts/app-shell";
import { obterUsuarioLogado } from "@/lib/sessao";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioLogado();
  return <AppShell usuario={usuario ? { nome: usuario.nome, perfil: usuario.perfil } : null}>{children}</AppShell>;
}
