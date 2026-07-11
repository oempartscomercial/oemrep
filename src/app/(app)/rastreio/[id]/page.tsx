import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarNotaFiscalComPermissao } from "../queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { proximosStatusRastreio, type StatusRastreio } from "@/domain/nfe/rastreio";
import { RastreioForm } from "./rastreio-form";

export default async function DetalheRastreioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const nota = await buscarNotaFiscalComPermissao(id, usuario);
  if (!nota) notFound();

  const eventos = await prisma.eventoRastreio.findMany({
    where: { notaFiscalId: nota.id },
    orderBy: { dataEvento: "desc" },
    include: { usuario: true },
  });

  const proximos = proximosStatusRastreio(nota.status as StatusRastreio);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>NFe {nota.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">{nota.chaveAcesso}</p>
          </div>
          <Badge variant="outline">{nota.status}</Badge>
        </CardHeader>
      </Card>

      {proximos.length > 0 ? (
        <RastreioForm notaFiscalId={nota.id} proximos={proximos} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Rastreio finalizado ({nota.status}). Não há próximas transições.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-2 px-6 pb-6 text-sm">
          {eventos.map((evento) => (
            <li key={evento.id} className="border-b pb-2">
              <span className="font-medium">
                {evento.statusAnterior} → {evento.status}
              </span>{" "}
              <span className="text-muted-foreground">
                ({new Date(evento.dataEvento).toLocaleDateString("pt-BR")} · {evento.usuario.nome})
              </span>
              {evento.observacao && <p className="text-muted-foreground">{evento.observacao}</p>}
            </li>
          ))}
          {eventos.length === 0 && (
            <p className="text-muted-foreground">Nenhum evento de rastreio ainda.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
