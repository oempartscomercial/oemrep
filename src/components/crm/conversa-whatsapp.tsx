import { agruparPorDia, descreverMensagem, formatarHora } from "@/domain/mensagens/exibicao";
import { formatarDia } from "@/domain/crm/prazo";
import type { TipoMensagem } from "@/domain/mensagens/evolution";
import { AcoesDaMensagem } from "@/components/crm/acoes-da-mensagem";
import { cn } from "@/lib/utils";

export type MensagemExibida = {
  id: string;
  direcao: "ENTRADA" | "SAIDA";
  origem: "CONTATO" | "ROMULO_NO_CELULAR" | "PLATAFORMA" | "ASSISTENTE";
  tipo: TipoMensagem;
  texto: string | null;
  ocorridoEm: Date;
  status: string;
  motivoBloqueio: string | null;
  erro: string | null;
  classificacao: string | null;
};

const ORIGEM_DA_SAIDA: Record<MensagemExibida["origem"], string> = {
  CONTATO: "",
  ROMULO_NO_CELULAR: "pelo celular",
  PLATAFORMA: "pela plataforma",
  ASSISTENTE: "pelo assistente",
};

const CLASSIFICACAO: Record<string, string> = {
  NAO_CONTATAR: "Pediu para não ser contatado",
  NAO_INTERESSADO: "Disse que não tem interesse",
};

// O que a pessoa precisa saber de uma mensagem nossa, em palavras simples.
function situacaoDaSaida(m: MensagemExibida): { rotulo: string; detalhe?: string | null; tom: "neutro" | "aviso" | "erro" } | null {
  switch (m.status) {
    case "RASCUNHO":
      return { rotulo: "Rascunho · falta sua aprovação", tom: "aviso" };
    case "APROVADA":
      return { rotulo: "Aprovada · ainda não saiu", detalhe: m.motivoBloqueio, tom: "aviso" };
    case "ENVIANDO":
      return { rotulo: "Enviando…", tom: "neutro" };
    case "FALHOU":
      return { rotulo: "Não foi enviada", detalhe: m.erro, tom: "erro" };
    case "CANCELADA":
      return { rotulo: "Cancelada", detalhe: m.motivoBloqueio, tom: "neutro" };
    default:
      return null;
  }
}
const RODAPE_DO_STATUS: Record<string, string> = { ENTREGUE: "entregue", LIDA: "lida" };

/** A conversa como o WhatsApp mostra: contato à esquerda, a OEM à direita. Rascunhos e pendências aparecem aqui, com os botões. */
export function ConversaWhatsapp({ mensagens, aviso }: { mensagens: MensagemExibida[]; aviso?: string }) {
  const grupos = agruparPorDia(mensagens);
  return (
    <div className="flex flex-col gap-4">
      {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
      {grupos.map((g) => (
        <div key={g.dia} className="flex flex-col gap-1.5">
          <p className="text-center text-xs text-muted-foreground">{formatarDia(g.dia)}</p>
          {g.mensagens.map((m) => {
            const { aviso: tipo, texto } = descreverMensagem(m);
            const minha = m.direcao === "SAIDA";
            const situacao = minha ? situacaoDaSaida(m) : null;
            const pendente = m.status === "RASCUNHO" || m.status === "APROVADA";
            const cancelada = m.status === "CANCELADA";
            const extras = [minha && ORIGEM_DA_SAIDA[m.origem], minha && RODAPE_DO_STATUS[m.status], formatarHora(m.ocorridoEm)].filter(Boolean).join(" · ");
            return (
              <div key={m.id} className={cn("flex", minha ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg border px-3 py-2 text-sm",
                    minha ? "bg-muted" : "bg-card",
                    pendente && "border-dashed border-warning/60 bg-warning-soft",
                    m.status === "FALHOU" && "border-destructive/40 bg-danger-soft",
                    cancelada && "opacity-60",
                  )}
                >
                  {situacao && (
                    <p className={cn("text-xs font-medium", situacao.tom === "aviso" && "text-warning", situacao.tom === "erro" && "text-destructive", situacao.tom === "neutro" && "text-muted-foreground")}>
                      {situacao.rotulo}
                    </p>
                  )}
                  {situacao?.detalhe && <p className="text-xs text-muted-foreground">{situacao.detalhe}</p>}
                  {tipo && <p className="text-xs italic text-muted-foreground">{tipo}</p>}
                  {texto && <p className={cn("whitespace-pre-wrap break-words", cancelada && "line-through")}>{texto}</p>}
                  {!minha && m.classificacao && CLASSIFICACAO[m.classificacao] && (
                    <p className="mt-1 text-xs font-medium text-destructive">{CLASSIFICACAO[m.classificacao]}</p>
                  )}
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">{extras}</p>
                  {minha && (m.status === "RASCUNHO" || m.status === "APROVADA") && texto && (
                    <AcoesDaMensagem id={m.id} status={m.status} texto={texto} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
