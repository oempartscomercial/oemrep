import Link from "next/link";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "./queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DivergenciasPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return <p className="text-sm text-red-600">Sessão expirada. Faça login novamente.</p>;
  }

  const chamados = await buscarChamadosPermitidos(usuario);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Divergências</CardTitle>
        </CardHeader>
      </Card>

      {chamados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum chamado aberto ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NFe</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chamados.map((chamado) => (
              <TableRow key={chamado.id}>
                <TableCell>{chamado.notaFiscal.numero}</TableCell>
                <TableCell>{chamado.motivo.nome}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{chamado.estado}</Badge>
                    {chamado.critico && <Badge variant="destructive">CRÍTICO</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/divergencias/${chamado.id}`} className="underline">
                    Ver
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
