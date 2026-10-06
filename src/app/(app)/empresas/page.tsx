import Link from "next/link";
import { Search } from "lucide-react";
import { listarEmpresas, lerTipoEmpresa, EMPRESAS_POR_PAGINA, type TipoEmpresa } from "./queries";
import { lerPagina } from "@/domain/paginacao";
import { descreverPrazo, formatarDia, hojeEmSaoPaulo, situacaoDoPrazo } from "@/domain/crm/prazo";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Paginacao } from "@/components/patterns/paginacao";
import { Input } from "@/components/ui/input";
import { Botao } from "@/components/patterns/botao";
import { cn } from "@/lib/utils";
import { EmpresasTabela, type EmpresaLinha } from "./empresas-tabela";

const ABAS: { id: TipoEmpresa; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "clientes", rotulo: "Clientes" },
  { id: "prospeccao", rotulo: "Prospecção" },
];

export default async function EmpresasPage({ searchParams }: { searchParams: Promise<{ tipo?: string; q?: string; pagina?: string }> }) {
  const params = await searchParams;
  const tipo = lerTipoEmpresa(params.tipo);
  const q = params.q ?? "";
  const { total, empresas, contagem } = await listarEmpresas(tipo, q, lerPagina(params.pagina));
  const hoje = hojeEmSaoPaulo();

  const linhas: EmpresaLinha[] = empresas.map((e) => {
    const passo = e.proximosPassos[0];
    const prazo = passo?.prazo.toISOString().slice(0, 10);
    return {
      id: e.id,
      nome: e.nomeFantasia,
      local: [e.cidade, e.uf].filter(Boolean).join("/"),
      situacao: e.situacao,
      fabricas: e.fabricas.map((cf) => cf.fabrica.nome),
      passo: passo && prazo ? { acao: passo.acao, quando: `${descreverPrazo(prazo, hoje)} · ${formatarDia(prazo)}`, atrasado: situacaoDoPrazo(prazo, hoje) === "atrasado" } : null,
      ultimoContato: e.interacoes[0] ? e.interacoes[0].data.toLocaleDateString("pt-BR") : null,
    };
  });

  const href = (t: TipoEmpresa) => {
    const busca = new URLSearchParams();
    if (t !== "todas") busca.set("tipo", t);
    if (q) busca.set("q", q);
    const s = busca.toString();
    return s ? `/empresas?${s}` : "/empresas";
  };

  return (
    <PageContainer>
      <PageHeader titulo="Empresas" descricao="Clientes e empresas em prospecção, num cadastro só." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Tipo de empresa" className="flex gap-1 border-b">
          {ABAS.map((aba) => (
            <Link
              key={aba.id}
              href={href(aba.id)}
              aria-current={aba.id === tipo ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                aba.id === tipo ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {aba.rotulo} <span className="text-xs text-muted-foreground">{contagem[aba.id]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" className="flex items-center gap-2">
          {tipo !== "todas" && <input type="hidden" name="tipo" value={tipo} />}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Nome, cidade, CNPJ ou contato" className="w-72 pl-8" />
          </div>
          <Botao type="submit">Buscar</Botao>
        </form>
      </div>

      <EmpresasTabela empresas={linhas} />
      <Paginacao pagina={lerPagina(params.pagina)} total={total} porPagina={EMPRESAS_POR_PAGINA} caminho="/empresas" params={{ tipo: tipo === "todas" ? undefined : tipo, q: q || undefined }} />
    </PageContainer>
  );
}
