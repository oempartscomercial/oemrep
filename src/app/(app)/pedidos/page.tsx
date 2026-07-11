import Link from "next/link";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosPermitidos } from "./queries";
import { filtrarPedidos, type FiltroPedido } from "@/domain/pedido/filtro";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ABAS: { valor: FiltroPedido; rotulo: string }[] = [
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "CONCLUIDOS", rotulo: "Concluídos" },
  { valor: "ARQUIVADOS", rotulo: "Arquivados" },
  { valor: "TODOS", rotulo: "Todos" },
];

function isFiltroPedido(valor: string): valor is FiltroPedido {
  return ABAS.some((aba) => aba.valor === valor);
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroBruto } = await searchParams;
  const filtro: FiltroPedido = filtroBruto && isFiltroPedido(filtroBruto) ? filtroBruto : "EM_ANDAMENTO";

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return <p className="text-sm text-red-600">Sessão expirada. Faça login novamente.</p>;
  }

  const pedidos = await buscarPedidosPermitidos(usuario);
  const filtrados = filtrarPedidos(pedidos, filtro);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pedidos</h1>
        <div className="flex gap-2">
          <Link href="/pedidos/importar">
            <Button variant="outline">Importar Excel</Button>
          </Link>
          <Link href="/pedidos/novo">
            <Button>Novo pedido</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {ABAS.map((aba) => (
          <Link
            key={aba.valor}
            href={`/pedidos?filtro=${aba.valor}`}
            className={
              filtro === aba.valor
                ? "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            }
          >
            {aba.rotulo}
          </Link>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Fábrica</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((pedido) => (
            <TableRow key={pedido.id}>
              <TableCell>
                <Link href={`/pedidos/${pedido.id}`} className="underline">
                  {pedido.semNumero ? "S/N" : pedido.numero}
                </Link>
              </TableCell>
              <TableCell>{pedido.fabrica.nome}</TableCell>
              <TableCell>{pedido.cliente.nomeFantasia}</TableCell>
              <TableCell>{pedido.itens.length}</TableCell>
              <TableCell>
                <Badge variant="outline">{pedido.estado}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filtrados.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum pedido nesta situação.</p>
      )}
    </div>
  );
}
