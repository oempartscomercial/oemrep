import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarClock, ChevronLeft, Globe, MapPin, UserRound } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { listarResponsaveis } from "../queries";
import { buscarCabecalho, buscarContatos, listarFabricas } from "./dados";
import { PageContainer } from "@/components/layouts/page-container";
import { Selo } from "@/components/patterns/status-badge";
import { SeloSituacao } from "@/components/crm/selo-situacao";
import { AvatarEmpresa, AvatarPessoa } from "@/components/crm/avatar-iniciais";
import { PrazoSelo } from "@/components/crm/prazo-selo";
import { formatarDiaComSemana, hojeEmSaoPaulo, situacaoDoPrazo } from "@/domain/crm/prazo";
import { ETAPAS_ATIVAS } from "@/domain/crm/funil";
import { alertaRegiaoRudolph } from "@/domain/crm/fabrica-prospeccao";
import { linkDoSite } from "@/domain/crm/cadastro";
import { formatarCnpj } from "@/domain/cadastro/cnpj";
import { normalizarTelefone } from "@/domain/mensagens/telefone";
import { cn } from "@/lib/utils";
import { FichaAcoes } from "./ficha-acoes";
import { EditarCadastro } from "./editar-cadastro";
import { AbasDaFicha } from "./abas-da-ficha";
import { Bloco, BlocoCarregando, CarteiraDaEmpresa, ContatosDaEmpresa, ConversasDaEmpresa, LinhaDoTempoDaEmpresa, PedidosDaEmpresa } from "./blocos";

const PROSPECCAO = new Set(["CANDIDATA", "APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO", "PAUSADA", "DESCARTADA"]);
const FUNDO_DO_PASSO = { atrasado: "bg-danger-soft/70", hoje: "bg-warning-soft/70", futuro: "bg-muted/50" } as const;

/**
 * Ficha da empresa, no formato de registro: cabeçalho com as ações, próximo passo em
 * destaque, linha do tempo no centro e a empresa na lateral. O cabeçalho sai com uma
 * consulta enxuta; cada bloco abaixo chega em streaming, no seu tempo.
 */
export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, usuario] = await Promise.all([params, obterUsuarioLogado()]);
  if (!usuario) return null; // o layout do CRM já mostra a sessão expirada
  const [empresa, responsaveis, contatos, fabricas] = await Promise.all([buscarCabecalho(id), listarResponsaveis(), buscarContatos(id), listarFabricas()]);
  if (!empresa) notFound();

  const hoje = hojeEmSaoPaulo();
  const ehAdmin = usuario.perfil === "ADMIN";
  const passo = empresa.proximosPassos[0] ?? null;
  const prazo = passo?.prazo.toISOString().slice(0, 10) ?? null;
  const emAndamento = (ETAPAS_ATIVAS as readonly string[]).includes(empresa.situacao);
  const foraDaRegiao = PROSPECCAO.has(empresa.situacao) && alertaRegiaoRudolph(empresa.uf, empresa.fabricas.map((f) => f.fabrica.nome));
  const site = linkDoSite(empresa.site);
  const resumo = { id: empresa.id, nome: empresa.nomeFantasia, situacao: empresa.situacao, naoContatar: empresa.naoContatar };
  // Atalho de WhatsApp: o primeiro contato com telefone, origem registrada e sem "não contatar".
  const principal = empresa.naoContatar
    ? null
    : contatos.find((c) => (c.canal === "WHATSAPP" || c.canal === "TELEFONE") && !c.naoContatar && c.origemContato && normalizarTelefone(c.valor) !== null) ?? null;
  const cadastro = {
    id: empresa.id,
    nome: empresa.nomeFantasia,
    cnpj: empresa.cnpj ? formatarCnpj(empresa.cnpj) : null,
    uf: empresa.uf,
    cidade: empresa.cidade,
    site: empresa.site,
    grupo: empresa.grupo,
    origem: empresa.origem,
    observacoes: empresa.observacoes,
    fabricasIds: empresa.fabricas.map((f) => f.fabricaId),
    ehCliente: empresa.situacao === "CLIENTE",
  };

  const propriedades: { rotulo: string; valor: React.ReactNode }[] = [
    { rotulo: "Cidade/UF", valor: [empresa.cidade, empresa.uf].filter(Boolean).join("/") || null },
    { rotulo: "Site", valor: site ? <a href={site} target="_blank" rel="noopener noreferrer" className="break-all underline-offset-2 hover:underline">{empresa.site}</a> : empresa.site },
    { rotulo: "CNPJ", valor: empresa.cnpj ? <span className="tabular">{formatarCnpj(empresa.cnpj)}</span> : null },
    { rotulo: "Grupo", valor: empresa.grupo },
    { rotulo: "Origem", valor: empresa.origem },
    {
      rotulo: empresa.situacao === "CLIENTE" ? "Fábricas que compra" : "Prospecção para",
      valor: empresa.fabricas.length ? <span className="flex flex-wrap gap-1">{empresa.fabricas.map((f) => <Selo key={f.fabricaId} cor="blue">{f.fabrica.nome}</Selo>)}</span> : null,
    },
    { rotulo: "Na base desde", valor: empresa.criadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) },
  ];

  return (
    <PageContainer className="max-w-[90rem] gap-4">
      <Link href="/empresas" className="-mb-1 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Empresas
      </Link>

      <section aria-label="Empresa" className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex items-start gap-3 md:gap-4">
            <AvatarEmpresa nome={empresa.nomeFantasia} tamanho="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight text-balance md:text-2xl">{empresa.nomeFantasia}</h1>
                <SeloSituacao situacao={empresa.situacao} forte />
                {empresa.naoContatar && <Selo cor="error">Não contatar</Selo>}
                {foraDaRegiao && <Selo cor="warning">Fora do Norte/Nordeste: sem Rudolph</Selo>}
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {(empresa.cidade || empresa.uf) && (
                  <li className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden />{[empresa.cidade, empresa.uf].filter(Boolean).join("/")}</li>
                )}
                {empresa.site && (
                  <li className="flex min-w-0 items-center gap-1.5">
                    <Globe className="size-3.5 shrink-0" aria-hidden />
                    {site ? <a href={site} target="_blank" rel="noopener noreferrer" className="truncate text-foreground underline-offset-2 hover:underline">{empresa.site.replace(/^https?:\/\//, "")}</a> : <span className="truncate">{empresa.site}</span>}
                  </li>
                )}
                {empresa.cnpj && <li className="flex items-center gap-1.5 tabular"><Building2 className="size-3.5" aria-hidden />{formatarCnpj(empresa.cnpj)}</li>}
                <li className="flex items-center gap-1.5">
                  <UserRound className="size-3.5" aria-hidden />
                  {passo ? <>Responsável: <span className="text-foreground">{passo.responsavel.nome}</span></> : "Sem responsável no momento"}
                </li>
              </ul>
            </div>
            {ehAdmin && (
              <div className="hidden shrink-0 md:block">
                <EditarCadastro atual={cadastro} fabricas={fabricas} />
              </div>
            )}
          </div>
          <FichaAcoes
            clienteId={empresa.id}
            nome={empresa.nomeFantasia}
            situacao={empresa.situacao}
            passoAbertoId={passo?.id ?? null}
            responsaveis={responsaveis}
            usuarioId={usuario.id}
            whatsapp={principal ? { contatoId: principal.id, nome: principal.nome ?? empresa.nomeFantasia } : null}
          />
        </div>

        {passo && prazo ? (
          <div className={cn("flex flex-col gap-2 border-t px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-5", FUNDO_DO_PASSO[situacaoDoPrazo(prazo, hoje)])}>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden /> Próximo passo
            </span>
            <p className="min-w-0 flex-1 text-sm font-semibold">{passo.acao}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <PrazoSelo prazo={prazo} hoje={hoje} />
              <span className="text-muted-foreground">{formatarDiaComSemana(prazo)}</span>
              <span className="flex items-center gap-1.5"><AvatarPessoa nome={passo.responsavel.nome} />{passo.responsavel.nome}</span>
            </div>
          </div>
        ) : (
          <div className={cn("flex items-center gap-2 border-t px-4 py-3 text-sm md:px-5", emAndamento ? "bg-warning-soft/70 font-medium text-warning" : "text-muted-foreground")}>
            <CalendarClock className="size-4" aria-hidden />
            {emAndamento ? "Sem próximo passo marcado. Toda empresa em andamento precisa de um." : "Nenhum próximo passo marcado."}
          </div>
        )}
      </section>

      <AbasDaFicha
        rotuloLateral={contatos.length === 0 ? "Empresa" : `Empresa · ${contatos.length} ${contatos.length === 1 ? "contato" : "contatos"}`}
        principal={
          <>
            <Suspense fallback={null}>
              <ConversasDaEmpresa empresa={resumo} />
            </Suspense>
            {/* Cliente: as fábricas da carteira são o assunto principal, ficam no centro. */}
            {empresa.situacao === "CLIENTE" && (
              <Suspense fallback={<BlocoCarregando linhas={2} />}>
                <CarteiraDaEmpresa empresa={resumo} fabricaIdsQueCompra={cadastro.fabricasIds} usuarioId={usuario.id} />
              </Suspense>
            )}
            <Suspense fallback={<BlocoCarregando linhas={5} alto />}>
              <LinhaDoTempoDaEmpresa clienteId={empresa.id} usuario={usuario} />
            </Suspense>
          </>
        }
        lateral={
          <>
            <Bloco titulo="Sobre a empresa" acao={ehAdmin ? <EditarCadastro atual={cadastro} fabricas={fabricas} variante="icone" /> : undefined}>
              <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3 text-sm">
                {propriedades.map((p) => (
                  <div key={p.rotulo} className="contents">
                    <dt className="text-muted-foreground">{p.rotulo}</dt>
                    <dd className={cn("min-w-0 break-words", !p.valor && "text-muted-foreground/70")}>{p.valor ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              {empresa.observacoes && (
                <div className="border-t px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Observações</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{empresa.observacoes}</p>
                </div>
              )}
            </Bloco>
            <Suspense fallback={<BlocoCarregando linhas={2} />}>
              <ContatosDaEmpresa empresa={resumo} podeEditar={podeVerCrm(usuario)} />
            </Suspense>
            <Suspense fallback={<BlocoCarregando linhas={2} />}>
              <PedidosDaEmpresa clienteId={empresa.id} usuario={usuario} />
            </Suspense>
          </>
        }
      />
    </PageContainer>
  );
}
