import { cache } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { SidebarMenuBadge } from "@/components/ui/sidebar";
import { formatarSeloPendencias } from "@/components/nav-pendencias";
import { contarPendenciasDeConversas } from "@/app/(app)/conversas/queries";

// Selo de Conversas no menu. Vem em streaming (Suspense no layout): a página não espera a
// contagem para aparecer. O `cache` faz o menu e o cabeçalho do celular contarem uma vez só.
const contar = cache(async (): Promise<number | null> => {
  try {
    return (await contarPendenciasDeConversas()).total;
  } catch (erro) {
    // Selo é acessório: se a contagem falhar, a página segue sem ele.
    console.error("Selo de Conversas: contagem falhou", erro);
    return null;
  }
});

export async function SeloConversasMenu() {
  const selo = formatarSeloPendencias(await contar());
  if (!selo) return null;
  return (
    <SidebarMenuBadge role="img" aria-label={selo.rotulo} className="bg-warning-soft text-warning peer-data-active/menu-button:text-warning">
      {selo.texto}
    </SidebarMenuBadge>
  );
}

export async function SeloConversasCabecalho() {
  const selo = formatarSeloPendencias(await contar());
  if (!selo) return null;
  return (
    <Link href="/conversas" aria-label={`${selo.rotulo} em Conversas`} className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-xs font-medium whitespace-nowrap text-warning">
      <MessageCircle className="size-3.5" aria-hidden />
      {selo.rotulo}
    </Link>
  );
}
