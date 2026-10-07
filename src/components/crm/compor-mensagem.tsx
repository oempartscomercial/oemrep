"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoTextarea } from "@/components/patterns/campo";
import { formatarNumero } from "@/domain/mensagens/exibicao";
import { aprovarMensagem, consultarEnvio, prepararMensagem, type ConsultaDeEnvio } from "@/app/(app)/conversas/actions";

const TITULO = { PRIMEIRO_CONTATO: "Primeira mensagem", FOLLOW_UP: "Follow-up", RESPOSTA: "Responder" } as const;

/** Escreve (ou ajusta o modelo), salva como rascunho ou aprova e envia. A pessoa decide; nada sai sozinho. */
export function ComporMensagem({ contatoId, nome, aoFechar }: { contatoId: string; nome: string; aoFechar: () => void }) {
  const router = useRouter();
  const [consulta, setConsulta] = useState<ConsultaDeEnvio | null>(null);
  const [texto, setTexto] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [resultado, setResultado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    consultarEnvio({ contatoId }).then((c) => {
      if (!vivo) return;
      setConsulta(c);
      setTexto(c.textoSugerido ?? "");
      setErros(c.erros);
    });
    return () => {
      vivo = false;
    };
  }, [contatoId]);

  const pendente = consulta?.pendente;
  const vazio = texto.trim().length === 0;
  const definitivos = consulta?.bloqueios?.filter((b) => !b.espera) ?? [];
  const esperas = consulta?.bloqueios?.filter((b) => b.espera) ?? [];

  async function salvar(aprovar: boolean) {
    setOcupado(true);
    setErros([]);
    const r = await prepararMensagem({ contatoId, texto });
    setAvisos(r.avisos ?? []);
    if (r.erros.length || !r.id) {
      setOcupado(false);
      return setErros(r.erros);
    }
    if (!aprovar) {
      setOcupado(false);
      router.refresh();
      return aoFechar();
    }
    const a = await aprovarMensagem({ id: r.id });
    setOcupado(false);
    router.refresh();
    if (a.erros.length) return setErros(a.erros);
    if (a.status === "ENVIADA") return aoFechar();
    setResultado(
      a.status === "APROVADA"
        ? `Aprovada, mas ainda não saiu. ${a.motivo ?? ""} Ela sai quando você tentar de novo.`
        : a.status === "FALHOU"
          ? `Não foi enviada. ${a.motivo ?? ""}`
          : `Não saiu: ${a.motivo ?? "bloqueada pelas proteções."}`,
    );
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-xl max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{consulta?.tipo ? TITULO[consulta.tipo] : "Mensagem"} · WhatsApp</DialogTitle>
          <DialogDescription>
            Para {nome}{consulta?.numero ? ` · ${formatarNumero(consulta.numero)}` : ""}. Você revisa e aprova: nada sai sem o seu OK.
          </DialogDescription>
        </DialogHeader>

        {!consulta ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : resultado ? (
          <p className="text-sm">{resultado}</p>
        ) : pendente ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              {pendente.status === "RASCUNHO" ? "Já existe um rascunho esperando sua aprovação para este contato." : "Já existe uma mensagem aprovada, esperando para sair."}
            </p>
            <p className="whitespace-pre-wrap break-words rounded-md border border-dashed border-warning/60 bg-warning-soft px-3 py-2 text-sm">{pendente.texto}</p>
            <p className="text-sm text-muted-foreground">Edite, aprove ou descarte essa mensagem na conversa. Só depois dá para escrever outra.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {consulta.ultimaRecebida && (
              <div className="rounded-md border bg-card px-3 py-2 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{nome} disse por último</p>
                <p className="line-clamp-4 whitespace-pre-wrap break-words">{consulta.ultimaRecebida}</p>
              </div>
            )}
            {definitivos.length > 0 && (
              <ul className="rounded-md border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-destructive">
                {definitivos.map((b) => (
                  <li key={b.codigo}>{b.texto}</li>
                ))}
              </ul>
            )}
            {esperas.length > 0 && (
              <ul className="rounded-md border bg-warning-soft px-3 py-2 text-sm text-warning">
                {esperas.map((b) => (
                  <li key={b.codigo}>{b.texto} Dá para aprovar agora: ela fica esperando e sai quando liberar.</li>
                ))}
              </ul>
            )}
            <CampoTextarea rotulo="Mensagem" rows={7} style={{ minHeight: "10rem" }} value={texto} onChange={(e) => setTexto(e.target.value)} />
            {avisos.map((a) => (
              <p key={a} className="text-sm text-warning">{a}</p>
            ))}
            {erros.map((e) => (
              <p key={e} className="text-sm text-destructive">{e}</p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Botao variante="ghost" className="h-11 md:h-8" onClick={aoFechar}>{resultado || pendente ? "Fechar" : "Cancelar"}</Botao>
          {consulta && !resultado && !pendente && (
            <>
              <Botao className="h-11 md:h-8" carregando={ocupado} disabled={vazio} onClick={() => salvar(false)}>Salvar rascunho</Botao>
              <Botao variante="primario" className="h-11 md:h-8" carregando={ocupado} disabled={definitivos.length > 0 || vazio} onClick={() => salvar(true)}>
                Aprovar e enviar
              </Botao>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
