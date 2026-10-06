import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarEventosAuditoria } from "@/app/(app)/auditoria/queries";
import { carregarNomesAuditoria } from "@/lib/auditoria-nomes";
import { descreverEvento } from "@/domain/auditoria/descricao";
import { gerarXlsx } from "@/domain/export/xlsx";
import { respostaXlsx } from "@/lib/resposta-xlsx";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  if (usuario.perfil === "OPERADOR") return NextResponse.json({ erro: "sem permissão" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const eventos = await buscarEventosAuditoria({
    de: params.get("de") ?? undefined,
    ate: params.get("ate") ?? undefined,
    usuarioId: params.get("usuarioId") ?? undefined,
    entidade: params.get("entidade") ?? undefined,
  });
  const nomes = await carregarNomesAuditoria(eventos);

  const buffer = await gerarXlsx(
    "Auditoria",
    ["Quando", "Usuário", "Registro", "Campo", "De", "Para"],
    eventos.map((e) => {
      const d = descreverEvento(e, nomes);
      return [e.criadoEm.toLocaleString("pt-BR"), e.usuario.nome, d.registro, d.campo, d.de, d.para];
    }),
  );
  return respostaXlsx(buffer, "auditoria.xlsx");
}
