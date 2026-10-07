import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { descreverMensagem, diaEmSaoPaulo, formatarHora, formatarNumero } from "@/domain/mensagens/exibicao";
import { formatarDia } from "@/domain/crm/prazo";
import Link from "next/link";
import { AcoesDaMensagem } from "@/components/crm/acoes-da-mensagem";
import { BotaoEscrever } from "@/components/crm/contato-acoes";
import { listarConversas, listarFollowUpsDeHoje, listarPendentes } from "./queries";
import { ConversasTabela, type ConversaLinha } from "./conversas-tabela";

const ROTULO_TIPO: Record<string, string> = { PRIMEIRO_CONTATO: "Primeiro contato", FOLLOW_UP: "Follow-up", RESPOSTA: "Resposta" };

function Bloco({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
      </div>
      <ul className="divide-y px-4">{children}</ul>
    </section>
  );
}

const quando = (d: Date) => `${formatarDia(diaEmSaoPaulo(d))} ${formatarHora(d)}`;

export default async function ConversasPage() {
  const [{ conversas, semTelefone, limite }, pendentes, followUps] = await Promise.all([listarConversas(), listarPendentes(), listarFollowUpsDeHoje()]);

  const linhas: ConversaLinha[] = conversas.map((c) => {
    const ultima = c.mensagens[0];
    const { aviso, texto } = ultima ? descreverMensagem(ultima) : { aviso: null, texto: null };
    const conteudo = aviso && texto ? `${aviso}: ${texto}` : (texto ?? aviso ?? "");
    return {
      id: c.id,
      empresaId: c.cliente?.id ?? null,
      empresa: c.cliente?.nomeFantasia ?? null,
      contato: c.contato?.nome ?? c.nomeNoWhatsapp,
      numero: formatarNumero(c.numero),
      motivoSemVinculo: c.motivoSemVinculo,
      previa: ultima ? `${ultima.direcao === "SAIDA" ? "Você: " : ""}${conteudo}`.slice(0, 120) : "",
      quando: quando(c.ultimaMensagemEm),
      total: c._count.mensagens,
    };
  });
  const aguardando = conversas.filter((c) => c.cliente && c.mensagens[0]?.direcao === "ENTRADA");
  const identificadas = linhas.filter((l) => l.empresaId);
  const semEmpresa = linhas.filter((l) => !l.empresaId);

  return (
    <PageContainer>
      <PageHeader titulo="Conversas" descricao="Mensagens da linha de prospecção no WhatsApp. Você escreve e aprova; nada sai sozinho." />

      {pendentes.length > 0 && (
        <Bloco titulo={`Para aprovar (${pendentes.length})`} dica="Nada sai sem o seu OK. Aprovada que não saiu está esperando horário, limite ou a linha.">
          {pendentes.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link href={`/empresas/${m.conversa.cliente?.id}`} className="font-medium hover:underline">
                  {m.conversa.cliente?.nomeFantasia ?? "Sem empresa"}
                </Link>
                <span className="text-xs text-muted-foreground">{ROTULO_TIPO[m.tipoEnvio ?? ""] ?? ""} · {m.status === "RASCUNHO" ? "rascunho" : "aprovada, esperando"}</span>
              </div>
              <p className="line-clamp-2 text-muted-foreground">{m.texto}</p>
              {m.motivoBloqueio && <p className="text-xs text-warning">{m.motivoBloqueio}</p>}
              {(m.status === "RASCUNHO" || m.status === "APROVADA") && m.texto && <AcoesDaMensagem id={m.id} status={m.status} texto={m.texto} />}
            </li>
          ))}
        </Bloco>
      )}

      {aguardando.length > 0 && (
        <Bloco titulo={`Aguardando sua resposta (${aguardando.length})`}>
          {aguardando.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <Link href={`/empresas/${c.cliente!.id}`} className="font-medium hover:underline">{c.cliente!.nomeFantasia}</Link>
              <span className="line-clamp-1 text-muted-foreground">{c.mensagens[0].texto ?? "Mensagem sem texto"}</span>
            </li>
          ))}
        </Bloco>
      )}

      {followUps.length > 0 && (
        <Bloco titulo={`Follow-ups para hoje (${followUps.length})`} dica="Já passou o intervalo, o contato não respondeu e ainda há tentativas. Você revisa e aprova.">
          {followUps.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 text-sm">
              <Link href={`/empresas/${c.cliente!.id}`} className="min-w-0 font-medium hover:underline">{c.cliente!.nomeFantasia}</Link>
              <BotaoEscrever contatoId={c.contato!.id} nome={c.contato!.nome ?? c.cliente!.nomeFantasia} rotulo="Preparar follow-up" />
            </li>
          ))}
        </Bloco>
      )}

      <ConversasTabela
        titulo="Com empresa cadastrada"
        linhas={identificadas}
        vazio="Nenhuma conversa registrada ainda. Quando o WhatsApp de prospecção estiver conectado, elas aparecem aqui."
      />

      {semEmpresa.length > 0 && (
        <ConversasTabela titulo="Sem identificar" linhas={semEmpresa} vazio="" />
      )}

      {semTelefone > 0 && (
        <p className="text-xs text-muted-foreground">
          {semTelefone} {semTelefone === 1 ? "mensagem veio" : "mensagens vieram"} de contatos sem telefone identificável (o WhatsApp esconde o número). Ficam guardadas, mas não aparecem nas listas.
        </p>
      )}
      {conversas.length === limite && <p className="text-xs text-muted-foreground">Mostrando as {limite} conversas mais recentes.</p>}
    </PageContainer>
  );
}
