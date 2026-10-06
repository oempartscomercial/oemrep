import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { descreverMensagem, diaEmSaoPaulo, formatarHora, formatarNumero } from "@/domain/mensagens/exibicao";
import { formatarDia } from "@/domain/crm/prazo";
import { listarConversas } from "./queries";
import { ConversasTabela, type ConversaLinha } from "./conversas-tabela";

const quando = (d: Date) => `${formatarDia(diaEmSaoPaulo(d))} ${formatarHora(d)}`;

export default async function ConversasPage() {
  const { conversas, semTelefone, limite } = await listarConversas();

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
  const identificadas = linhas.filter((l) => l.empresaId);
  const semEmpresa = linhas.filter((l) => !l.empresaId);

  return (
    <PageContainer>
      <PageHeader titulo="Conversas" descricao="Mensagens da linha de prospecção no WhatsApp. Por enquanto só leitura: nada é enviado por aqui." />

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
