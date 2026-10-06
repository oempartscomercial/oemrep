"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/cadastros/fabricas", label: "Fábricas" },
  { href: "/cadastros/clientes", label: "Clientes" },
  { href: "/cadastros/usuarios", label: "Usuários" },
];

export function CadastrosNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b">
      {ABAS.map((aba) => {
        const ativo = pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              ativo ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
