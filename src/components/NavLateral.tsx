import Link from "next/link";
import { ITENS_MENU } from "./nav-itens";

export function NavLateral() {
  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r p-4">
      {ITENS_MENU.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded px-3 py-2 hover:bg-gray-100"
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  );
}
