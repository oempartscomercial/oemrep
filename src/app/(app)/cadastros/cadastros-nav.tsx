"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/utils/cx";

const ABAS = [
  { href: "/cadastros/fabricas", label: "Fábricas" },
  { href: "/cadastros/clientes", label: "Clientes" },
  { href: "/cadastros/usuarios", label: "Usuários" },
];

export function CadastrosNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-secondary pb-3">
      {ABAS.map((aba) => {
        const ativo = pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              ativo ? "bg-brand-solid text-white" : "text-tertiary hover:bg-primary_hover",
            )}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
