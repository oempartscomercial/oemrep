import { obterUsuarioLogado } from "@/lib/sessao";
import { listarTokens } from "@/lib/mcp/tokens";
import { origemDoApp } from "@/lib/origem";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { PainelConexao, type AcessoLinha } from "./painel-conexao";

const quando = (d: Date | null) =>
  d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export default async function ConectarClaudePage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null; // o layout já mostra a sessão expirada
  const tokens = await listarTokens(usuario);
  const acessos: AcessoLinha[] = tokens.map((t) => ({
    id: t.id,
    nome: t.nome,
    prefixo: t.prefixo,
    origem: t.origem,
    expirado: t.expirado,
    dono: t.meu ? null : t.dono,
    criadoEm: quando(t.criadoEm)!,
    ultimoUsoEm: quando(t.ultimoUsoEm),
    revogadoEm: quando(t.revogadoEm),
  }));

  return (
    <PageContainer>
      <PageHeader
        titulo="Conectar o Claude"
        descricao="Deixa o Claude ler e anotar no CRM por você: agenda, fichas, carteira e registros. Tudo o que ele grava fica no seu nome, marcado “pelo Claude”."
      />
      <PainelConexao acessos={acessos} origem={await origemDoApp()} nomeSugerido={`Claude de ${usuario.nome.split(" ")[0]}`} />
    </PageContainer>
  );
}
