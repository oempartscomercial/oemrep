"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analisarXmlNFe, confirmarBaixaNFe, type AnaliseNFe } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ConferenciaNFePage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [analise, setAnalise] = useState<AnaliseNFe | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleAnalisar(formData: FormData) {
    setErro(null);
    setAnalise(null);
    const resultado = await analisarXmlNFe(formData);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setAnalise(resultado.analise ?? null);
  }

  async function handleConfirmar() {
    if (!analise) return;
    setEnviando(true);
    const resultado = await confirmarBaixaNFe(analise);
    setEnviando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/pedidos");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Conferência de NFe</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleAnalisar} className="flex items-end gap-2">
            <Input type="file" name="arquivo" accept=".xml" required />
            <Button type="submit">Analisar</Button>
          </form>
          {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
        </CardContent>
      </Card>

      {analise && (
        <Card>
          <CardHeader>
            <CardTitle>
              NFe {analise.nfe.numero} · destinatário {analise.nfe.destinatarioCnpj}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(!analise.clienteId || !analise.fabricaId) && (
              <p className="text-sm text-destructive">
                Fábrica ou cliente desta NFe não está cadastrado no sistema.
              </p>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Qtd. NFe</TableHead>
                  <TableHead>Valor unit.</TableHead>
                  <TableHead>Divergências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analise.conferencia.map((resultado) => (
                  <TableRow key={resultado.itemNFe.referencia}>
                    <TableCell>{resultado.itemNFe.referencia}</TableCell>
                    <TableCell>{resultado.itemNFe.descricao}</TableCell>
                    <TableCell>{resultado.itemNFe.quantidade}</TableCell>
                    <TableCell>R$ {resultado.itemNFe.valorUnitario.toFixed(2)}</TableCell>
                    <TableCell>
                      {resultado.divergencias.length === 0 ? (
                        <Badge variant="outline">OK</Badge>
                      ) : (
                        resultado.divergencias.map((d) => (
                          <p key={d} className="text-sm text-destructive">
                            {d}
                          </p>
                        ))
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button onClick={handleConfirmar} disabled={enviando || !analise.clienteId || !analise.fabricaId}>
              Confirmar baixa
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
