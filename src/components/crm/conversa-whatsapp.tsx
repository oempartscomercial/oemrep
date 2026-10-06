import { agruparPorDia, descreverMensagem, formatarHora } from "@/domain/mensagens/exibicao";
import { formatarDia } from "@/domain/crm/prazo";
import type { TipoMensagem } from "@/domain/mensagens/evolution";
import { cn } from "@/lib/utils";

export type MensagemExibida = {
  id: string;
  direcao: "ENTRADA" | "SAIDA";
  origem: "CONTATO" | "ROMULO_NO_CELULAR" | "PLATAFORMA" | "ASSISTENTE";
  tipo: TipoMensagem;
  texto: string | null;
  ocorridoEm: Date;
};

const ORIGEM_DA_SAIDA: Record<MensagemExibida["origem"], string> = {
  CONTATO: "",
  ROMULO_NO_CELULAR: "pelo celular",
  PLATAFORMA: "pela plataforma",
  ASSISTENTE: "pelo assistente",
};

/** A conversa como o WhatsApp mostra: contato à esquerda, a OEM à direita. Só leitura. */
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
            return (
              <div key={m.id} className={cn("flex", minha ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-lg border px-3 py-2 text-sm", minha ? "bg-muted" : "bg-card")}>
                  {tipo && <p className="text-xs italic text-muted-foreground">{tipo}</p>}
                  {texto && <p className="whitespace-pre-wrap break-words">{texto}</p>}
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    {minha && ORIGEM_DA_SAIDA[m.origem] ? `${ORIGEM_DA_SAIDA[m.origem]} · ` : ""}
                    {formatarHora(m.ocorridoEm)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

