import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin, Pencil } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarFicha, listarResponsaveis } from "../queries";
import { PageContainer } from "@/components/layouts/page-container";
import { Botao } from "@/components/patterns/botao";
import { Selo, StatusBadge } from "@/components/patterns/status-badge";
import { Timeline, type TimelineItem } from "@/components/patterns/timeline";
import { SeloSituacao } from "@/components/crm/selo-situacao";
import { descreverPrazo, formatarDia, hojeEmSaoPaulo, situacaoDoPrazo } from "@/domain/crm/prazo";
import { cn } from "@/lib/utils";
import { FichaAcoes } from "./ficha-acoes";

const CANAL: Record<string, string> = { WHATSAPP: "WhatsApp", TELEFONE: "Ligação", EMAIL: "E-mail", VISITA: "Visita", REUNIAO: "Reunião", PESQUISA: "Pesquisa", OUTRO: "Anotação", LINKEDIN: "LinkedIn" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <h2 className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">{titulo}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null; // o layout do CRM já mostra a sessão expirada
  const [ficha, responsaveis] = await Promise.all([buscarFicha(id, usuario), listarResponsaveis()]);
  if (!ficha) notFound();
  const { empresa, historico } = ficha;
  const hoje = hojeEmSaoPaulo();
  const passo = empresa.proximosPassos[0] ?? null;
  const prazo = passo?.prazo.toISOString().slice(0, 10);
  const atrasado = prazo ? situacaoDoPrazo(prazo, hoje) === "atrasado" : false;

  const eventos: (TimelineItem & { quando: number })[] = [
    ...empresa.interacoes.map((i) => ({
      id: `i-${i.id}`,
      quando: i.data.getTime(),
      titulo: `${CANAL[i.canal] ?? i.canal}${i.comQuem ? ` · ${i.comQuem}` : ""}`,
      descricao: [i.resumo, i.resultado && `Resultado: ${i.resultado}`].filter(Boolean).join(" — "),
      data: i.data.toLocaleDateString("pt-BR"),
      autor: i.origem === "USUARIO" ? i.usuario?.nome : i.origem === "AUTOMACAO" ? "automação" : "importação",
    })),
    ...empresa.pedidos.map((p) => ({
      id: `p-${p.id}`,
      quando: p.criadoEm.getTime(),
      titulo: `Pedido ${p.semNumero ? "S/N" : p.numero} lançado`,
      descricao: p.fabrica.nome,
      data: p.criadoEm.toLocaleDateString("pt-BR"),
    })),
  ].sort((a, b) => b.quando - a.quando);

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{empresa.nomeFantasia}</h1>
            <SeloSituacao situacao={empresa.situacao} />
            {empresa.naoContatar && <Selo cor="error">Não contatar</Selo>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {(empresa.cidade || empresa.uf) && (
              <span className="flex items-center gap-1"><MapPin className="size-3.5" />{[empresa.cidade, empresa.uf].filter(Boolean).join("/")}</span>
            )}
            {empresa.site && (
              <span className="flex items-center gap-1"><Globe className="size-3.5" />{empresa.site}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {usuario.perfil === "ADMIN" && (
            <Botao variante="ghost" icone={<Pencil />} href={`/cadastros/clientes/${empresa.id}`}>Editar cadastro</Botao>
          )}
        </div>
      </div>

      <FichaAcoes
        clienteId={empresa.id}
        nome={empresa.nomeFantasia}
        situacao={empresa.situacao}
        passoAbertoId={passo?.id ?? null}
        responsaveis={responsaveis}
        usuarioId={usuario.id}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <section className={cn("rounded-lg border bg-card px-4 py-3", atrasado && "border-destructive/40 bg-danger-soft")}>
            <p className="text-xs font-medium text-muted-foreground">Próximo passo</p>
            {passo && prazo ? (
              <p className="mt-1 text-sm">
                <span className="font-medium">{passo.acao}</span>
                <span className={cn("ml-2", atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {descreverPrazo(prazo, hoje)} · {formatarDia(prazo)} · {passo.responsavel.nome}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {["APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO"].includes(empresa.situacao) ? "Sem próximo passo marcado. Toda empresa em andamento precisa de um." : "Nenhum marcado."}
              </p>
            )}
          </section>

          <Bloco titulo="Linha do tempo">
            {eventos.length > 0 ? <Timeline eventos={eventos} /> : <p className="text-sm text-muted-foreground">Ainda não há nada registrado.</p>}
          </Bloco>
        </div>

        <div className="flex flex-col gap-4">
          <Bloco titulo="Dados">
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">CNPJ</dt>
              <dd>{empresa.cnpj ?? "—"}</dd>
              <dt className="text-muted-foreground">Origem</dt>
              <dd>{empresa.origem ?? "—"}</dd>
              <dt className="text-muted-foreground">Grupo</dt>
              <dd>{empresa.grupo ?? "—"}</dd>
              <dt className="text-muted-foreground">Fábricas</dt>
              <dd className="flex flex-wrap gap-1">{empresa.fabricas.length ? empresa.fabricas.map((cf) => <Selo key={cf.fabricaId}>{cf.fabrica.nome}</Selo>) : "—"}</dd>
            </dl>
            {empresa.observacoes && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{empresa.observacoes}</p>}
          </Bloco>

          <Bloco titulo={`Contatos (${empresa.contatos.length})`}>
            {empresa.contatos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato com fonte anotada.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {empresa.contatos.map((c) => (
                  <li key={c.id} className="text-sm leading-snug">
                    <p className="font-medium">
                      {c.nome ?? "Canal da empresa"}
                      {c.funcao && <span className="font-normal text-muted-foreground"> · {c.funcao}</span>}
                      {c.naoContatar && <span className="ml-2"><Selo cor="error">Não contatar</Selo></span>}
                    </p>
                    <p>{c.valor} <span className="text-muted-foreground">({CANAL[c.canal] ?? c.canal})</span></p>
                    <p className="text-xs text-muted-foreground">Fonte: {c.fonte}</p>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          <Bloco titulo="Pedidos">
            {empresa.pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido no sistema.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {empresa.pedidos.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/pedidos/${p.id}`} className="min-w-0 truncate hover:underline">
                      {p.semNumero ? "S/N" : p.numero} <span className="text-muted-foreground">· {p.fabrica.nome}</span>
                    </Link>
                    <StatusBadge tipo="pedido" valor={p.estado} />
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          {historico.length > 0 && (
            <Bloco titulo="Pedidos recebidos (planilha)">
              <ul className="flex flex-col gap-2 text-sm">
                {historico.map((h) => (
                  <li key={h.fabrica} className="flex items-baseline justify-between gap-2">
                    <span>{h.fabrica} <span className="text-muted-foreground">· {h.pedidos} pedidos</span></span>
                    <span className="tabular font-medium">{brl(h.valor)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Pedidos que chegaram, não faturamento. Linhas suspeitas de duplicidade ficam fora da soma.</p>
            </Bloco>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
