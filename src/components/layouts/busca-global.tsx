"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Package, Search, User } from "lucide-react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { buscarGlobalAction } from "@/app/(app)/busca-actions";
import type { BuscaGlobal } from "@/app/(app)/empresas/queries";

const VAZIO: BuscaGlobal = { empresas: [], contatos: [], pedidos: [] };

/** Botão "Buscar…" + paleta ⌘K: empresas, pessoas (abrem a empresa) e pedidos. */
export function BuscaGlobalBotao() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [resultado, setResultado] = useState<BuscaGlobal>(VAZIO);
  const [consultaDe, setConsultaDe] = useState("");
  const versao = useRef(0);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAberto((a) => !a);
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  // Espera o usuário parar de digitar; descarta resposta de busca já superada.
  useEffect(() => {
    if (q.trim().length < 2) return;
    const minha = ++versao.current;
    const t = setTimeout(async () => {
      const r = await buscarGlobalAction(q);
      if (minha === versao.current) {
        setResultado(r);
        setConsultaDe(q);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function ir(href: string) {
    setAberto(false);
    setQ("");
    router.push(href);
  }

  // Com menos de 2 letras, mostra vazio sem depender de efeito.
  const curto = q.trim().length < 2;
  const visivel = curto ? VAZIO : resultado;
  const total = visivel.empresas.length + visivel.contatos.length + visivel.pedidos.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-11 md:h-8 w-full items-center gap-2 rounded-md border bg-background px-2 text-sm text-muted-foreground hover:bg-muted"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border bg-muted px-1 text-[10px] font-medium">⌘K</kbd>
      </button>

      <CommandDialog open={aberto} onOpenChange={setAberto} title="Busca" description="Procure empresas, pessoas e pedidos">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Empresa, pessoa ou número do pedido…" value={q} onValueChange={setQ} />
          <CommandList>
            {!curto && consultaDe === q && total === 0 && <CommandEmpty>Nada encontrado.</CommandEmpty>}
            {curto && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Digite pelo menos 2 letras.</p>}
            {visivel.empresas.length > 0 && (
              <CommandGroup heading="Empresas">
                {visivel.empresas.map((e) => (
                  <CommandItem key={e.id} className="py-2.5 md:py-1.5" value={`empresa-${e.id}`} onSelect={() => ir(`/empresas/${e.id}`)}>
                    <Building2 />
                    <span>{e.nome}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{e.detalhe}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {visivel.contatos.length > 0 && (
              <CommandGroup heading="Pessoas">
                {visivel.contatos.map((c) => (
                  <CommandItem key={c.id} className="py-2.5 md:py-1.5" value={`contato-${c.id}`} onSelect={() => ir(`/empresas/${c.empresaId}`)}>
                    <User />
                    <span>{c.nome}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.detalhe}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {visivel.pedidos.length > 0 && (
              <CommandGroup heading="Pedidos">
                {visivel.pedidos.map((p) => (
                  <CommandItem key={p.id} className="py-2.5 md:py-1.5" value={`pedido-${p.id}`} onSelect={() => ir(`/pedidos/${p.id}`)}>
                    <Package />
                    <span>{p.numero}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{p.detalhe}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
