import { NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarNotasFiscaisPermitidas } from "@/app/(app)/rastreio/queries";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";
import { gerarXlsx } from "@/domain/export/xlsx";
import { respostaXlsx } from "@/lib/resposta-xlsx";

export async function GET() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const notas = await buscarNotasFiscaisPermitidas(usuario);
  const buffer = await gerarXlsx(
    "Rastreio",
    ["NFe", "Emissão", "Chave de acesso", "Status", "Total da nota"],
    notas.map((n) => [
      n.numero,
      n.dataEmissao.toLocaleDateString("pt-BR"),
      n.chaveAcesso,
      statusBadgeConfig("nfe", n.status).label,
      Number(n.totalNota),
    ]),
  );
  return respostaXlsx(buffer, "rastreio.xlsx");
}
