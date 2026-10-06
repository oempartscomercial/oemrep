import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { gerarXlsx, type CelulaXlsx } from "@/domain/export/xlsx";
import { respostaXlsx } from "@/lib/resposta-xlsx";

const PERFIS: Record<string, string> = { ADMIN: "Administrador", ANALISTA: "Analista", OPERADOR: "Operador" };
const simNao = (v: boolean) => (v ? "Sim" : "Não");

async function planilha(tipo: string): Promise<[string, string[], CelulaXlsx[][]] | null> {
  if (tipo === "fabricas") {
    const fabricas = await prisma.fabrica.findMany({ orderBy: { nome: "asc" } });
    return ["Fábricas", ["Nome", "CNPJ", "Ativa"], fabricas.map((f) => [f.nome, f.cnpj, simNao(f.ativo)])];
  }
  if (tipo === "clientes") {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nomeFantasia: "asc" },
      include: { fabricas: { include: { fabrica: true } } },
    });
    return [
      "Clientes",
      ["Nome", "CNPJ", "Cidade", "UF", "Fábricas"],
      clientes.map((c) => [
        c.nomeFantasia,
        c.cnpj ?? "",
        c.cidade ?? "",
        c.uf ?? "",
        c.fabricas.map((cf) => cf.fabrica.nome).join(", "),
      ]),
    ];
  }
  if (tipo === "usuarios") {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { nome: "asc" },
      include: { fabricas: { include: { fabrica: true } } },
    });
    return [
      "Usuários",
      ["Nome", "E-mail", "Perfil", "Fábricas", "Ativo"],
      usuarios.map((u) => [
        u.nome,
        u.email,
        PERFIS[u.perfil] ?? u.perfil,
        u.perfil === "OPERADOR" ? u.fabricas.map((uf) => uf.fabrica.nome).join(", ") : "Todas",
        simNao(u.ativo),
      ]),
    ];
  }
  return null;
}

// Cadastros é só do ADMIN (PRD §4), inclusive a exportação.
export async function GET(_request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  if (usuario.perfil !== "ADMIN") return NextResponse.json({ erro: "sem permissão" }, { status: 403 });

  const { tipo } = await params;
  const dados = await planilha(tipo);
  if (!dados) return NextResponse.json({ erro: "cadastro desconhecido" }, { status: 404 });

  const [nome, cabecalhos, linhas] = dados;
  return respostaXlsx(await gerarXlsx(nome, cabecalhos, linhas), `${tipo}.xlsx`);
}
