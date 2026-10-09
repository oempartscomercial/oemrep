"use client";

import Link from "next/link";
import { ChevronDown, FilePlus2, FileSpreadsheet, MessageSquareText, PencilLine } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Botao } from "@/components/patterns/botao";

const OPCOES = [
  { href: "/pedidos/rapido", icone: MessageSquareText, titulo: "Rápido (WhatsApp)", descricao: "Só cliente e valor; itens depois" },
  { href: "/pedidos/importar-pdf", icone: FilePlus2, titulo: "Importar PDF", descricao: "PDF do pedido da fábrica" },
  { href: "/pedidos/importar", icone: FileSpreadsheet, titulo: "Importar Excel", descricao: "Planilha com os itens" },
  { href: "/pedidos/novo", icone: PencilLine, titulo: "Digitar com itens", descricao: "Cadastro manual completo" },
];

/** Um botão só para os quatro jeitos de um pedido entrar — antes eram quatro botões competindo. */
export function RegistrarPedidoMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Botao variante="primario" className="h-11 md:h-8">
          Registrar pedido <ChevronDown className="size-4" />
        </Botao>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {OPCOES.map((o) => (
          <DropdownMenuItem key={o.href} asChild className="items-start gap-2.5 py-2">
            <Link href={o.href}>
              <o.icone className="mt-0.5 size-4 shrink-0" />
              <span className="flex flex-col">
                <span className="font-medium">{o.titulo}</span>
                <span className="text-xs text-muted-foreground">{o.descricao}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
