import { notFound } from "next/navigation";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadoComPermissao } from "../queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { proximosEstadosChamado, type EstadoChamado } from "@/domain/chamado/estado";
import { ChamadoEventoForm } from "./chamado-evento-form";

export default async function DetalheChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const chamado = await buscarChamadoComPermissao(id, usuario);
  if (!chamado) notFound();

  const proximos = proximosEstadosChamado(chamado.estado as EstadoChamado);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Chamado — NFe {chamado.notaFiscal.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">{chamado.motivo.nome}</p>
          </div>
          <Badge variant="outline">{chamado.estado}</Badge>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens afetados</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-1 px-6 pb-6 text-sm">
          {chamado.itensAfetados.map(({ itemPedido }) => (
            <li key={itemPedido.id}>
              {itemPedido.referencia} — {itemPedido.descricao}
            </li>
          ))}
        </ul>
      </Card>

      {proximos.length > 0 ? (
        <ChamadoEventoForm chamadoId={chamado.id} proximos={proximos} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Chamado resolvido. Não há próximas transições.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-2 px-6 pb-6 text-sm">
          {chamado.eventos.map((evento) => (
            <li key={evento.id} className="border-b pb-2">
              <span className="font-medium">
                {evento.estadoAnterior ? `${evento.estadoAnterior} → ${evento.estado}` : `Aberto (${evento.estado})`}
              </span>{" "}
              <span className="text-muted-foreground">
                ({new Date(evento.criadoEm).toLocaleString("pt-BR")} · {evento.usuario.nome})
              </span>
              <p className="text-muted-foreground">{evento.observacao}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
