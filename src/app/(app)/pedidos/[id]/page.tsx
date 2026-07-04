import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemStatusForm } from "./item-status-form";
import { PedidoAcoes } from "./pedido-acoes";

export default async function DetalhePedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { fabrica: true, cliente: true, itens: true },
  });
  if (!pedido) notFound();

  const eventos = await prisma.eventoAuditoria.findMany({
    where: { entidade: "Pedido", entidadeId: pedido.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pedido {pedido.semNumero ? "S/N" : pedido.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {pedido.fabrica.nome} · {pedido.cliente.nomeFantasia}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{pedido.estado}</Badge>
            <PedidoAcoes pedidoId={pedido.id} estado={pedido.estado} />
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="itens">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Pedida</TableHead>
                <TableHead>Faturada</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedido.itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.referencia}</TableCell>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>{item.quantidadePedida}</TableCell>
                  <TableCell>{item.quantidadeFaturada}</TableCell>
                  <TableCell>
                    <ItemStatusForm itemId={item.id} statusAtual={item.status} observacaoAtual={item.observacao ?? ""} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="notas">
          <p className="text-sm text-muted-foreground">
            Nenhuma NFe vinculada ainda — chega no próximo épico.
          </p>
        </TabsContent>

        <TabsContent value="historico">
          <ul className="flex flex-col gap-2 text-sm">
            {eventos.map((evento) => (
              <li key={evento.id} className="border-b pb-2">
                <span className="font-medium">{evento.campo}</span>: {evento.valorAnterior ?? "—"} →{" "}
                {evento.valorNovo ?? "—"}{" "}
                <span className="text-muted-foreground">
                  ({new Date(evento.criadoEm).toLocaleString("pt-BR")})
                </span>
              </li>
            ))}
            {eventos.length === 0 && (
              <p className="text-muted-foreground">Nenhum evento registrado ainda.</p>
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
