import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { agruparCruzamentoPorPedido, type LinhaFaturamento } from "@/domain/nfe/relatorio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function RelatorioCruzamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const notaFiscal = await prisma.notaFiscal.findUnique({
    where: { id },
    include: { itensFaturados: { include: { itemPedido: { include: { pedido: true } } } } },
  });
  if (!notaFiscal) notFound();

  const fabricaId = await obterFabricaIdDaNotaFiscal(id);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) notFound();

  const linhas: LinhaFaturamento[] = notaFiscal.itensFaturados.map((faturado) => ({
    pedidoId: faturado.itemPedido.pedidoId,
    pedidoNumero: faturado.itemPedido.pedido.semNumero
      ? "S/N"
      : (faturado.itemPedido.pedido.numero ?? "S/N"),
    referencia: faturado.itemPedido.referencia,
    descricao: faturado.itemPedido.descricao,
    quantidadeFaturada: faturado.quantidadeFaturada,
    valorUnitario: Number(faturado.itemPedido.valorUnitario),
  }));

  const grupos = agruparCruzamentoPorPedido(linhas);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cruzamento — NFe {notaFiscal.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">Chave: {notaFiscal.chaveAcesso}</p>
          </div>
          <Link href={`/divergencias/nova?notaFiscalId=${notaFiscal.id}`} className="underline">
            Abrir chamado
          </Link>
        </CardHeader>
      </Card>

      {grupos.map((grupo) => (
        <Card key={grupo.pedidoId}>
          <CardHeader>
            <CardTitle className="text-base">Pedido {grupo.pedidoNumero}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Qtd. faturada</TableHead>
                  <TableHead>Valor unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupo.linhas.map((linha) => (
                  <TableRow key={`${linha.pedidoId}-${linha.referencia}`}>
                    <TableCell>{linha.referencia}</TableCell>
                    <TableCell>{linha.descricao}</TableCell>
                    <TableCell>{linha.quantidadeFaturada}</TableCell>
                    <TableCell>R$ {linha.valorUnitario.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-sm text-muted-foreground">
              Total faturado neste pedido: R$ {grupo.totalFaturado.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
