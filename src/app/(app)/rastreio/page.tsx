import Link from "next/link";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarNotasFiscaisPermitidas } from "./queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function RastreioPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return <p className="text-sm text-red-600">Sessão expirada. Faça login novamente.</p>;
  }

  const notas = await buscarNotasFiscaisPermitidas(usuario);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Rastreio de NFe</CardTitle>
        </CardHeader>
      </Card>

      {notas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma NFe importada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Chave de acesso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.map((nota) => (
              <TableRow key={nota.id}>
                <TableCell>{nota.numero}</TableCell>
                <TableCell>{nota.chaveAcesso}</TableCell>
                <TableCell>
                  <Badge variant="outline">{nota.status}</Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/rastreio/${nota.id}`} className="underline">
                    Ver / atualizar
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
