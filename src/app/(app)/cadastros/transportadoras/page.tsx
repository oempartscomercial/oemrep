import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { PageHeader } from "@/components/patterns/page-header";
import { TransportadorasTabela, type TransportadoraLinha } from "./transportadoras-tabela";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

export default async function TransportadorasPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.perfil !== "ADMIN") {
    return <p className="text-sm text-destructive">Acesso restrito a administradores.</p>;
  }

  const transportadoras = await prisma.transportadora.findMany({
    include: { _count: { select: { notasFiscais: { where: { status: { in: ["TRANSITO", "AGENDADO"] } } } } } },
    orderBy: [{ metodo: "desc" }, { nome: "asc" }],
  });
  const linhas: TransportadoraLinha[] = transportadoras.map((t) => ({
    id: t.id,
    nome: t.nome,
    cnpj: t.cnpj,
    metodo: t.metodo,
    contato: t.contato ?? "",
    urlPublica: t.urlPublica ?? "",
    observacao: t.observacao ?? "",
    emTransito: t._count.notasFiscais,
    ultimaConsultaOk: fmt(t.ultimaConsultaOk),
    issueUrl: t.issueUrl,
  }));

  return (
    <>
      <PageHeader
        titulo="Transportadoras"
        descricao="Entram sozinhas quando uma nota é conferida. As que usam o SSW são rastreadas todo dia; as outras precisam de ajuste aqui."
      />
      <TransportadorasTabela transportadoras={linhas} />
    </>
  );
}
