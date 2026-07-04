import Link from "next/link";
import { ITENS_MENU } from "./nav-itens";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NavLateral() {
  return (
    <nav className="flex h-screen w-56 flex-col gap-1 border-r bg-background p-4">
      <p className="mb-2 px-3 text-sm font-semibold text-muted-foreground">
        OEM Representações
      </p>
      {ITENS_MENU.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(buttonVariants({ variant: "ghost" }), "h-9 justify-start")}
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  );
}
