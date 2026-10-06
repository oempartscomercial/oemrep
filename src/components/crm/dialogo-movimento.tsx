"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoCheckbox, CampoTexto } from "@/components/patterns/campo";
import { PassoCampos, type PassoForm } from "./passo-campos";
import { moverEmpresa } from "@/app/(app)/empresas/actions";
import { etapaAtiva, ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";
import { hojeEmSaoPaulo, somarDias } from "@/domain/crm/prazo";

export type AlvoMovimento = { clienteId: string; nome: string; de: string; para: string };

/**
 * Janelinha de mudança de etapa: pede o que a regra do funil exige (próximo passo,
 * retomada ou motivo). Cancelar não grava nada; quem abre devolve o card ao lugar.
 */
export function DialogoMovimento({
  alvo,
  responsaveis,
  usuarioId,
  aoFechar,
}: {
  alvo: AlvoMovimento | null;
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
  aoFechar: (movido: boolean) => void;
}) {
  return (
    <Dialog open={!!alvo} onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent className="sm:max-w-md">
        {/* key reinicia o formulário a cada novo movimento */}
        {alvo && <Formulario key={`${alvo.clienteId}-${alvo.para}`} alvo={alvo} responsaveis={responsaveis} usuarioId={usuarioId} aoFechar={aoFechar} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  alvo,
  responsaveis,
  usuarioId,
  aoFechar,
}: {
  alvo: AlvoMovimento;
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
  aoFechar: (movido: boolean) => void;
}) {
  const hoje = hojeEmSaoPaulo();
  const [passo, setPasso] = useState<PassoForm>({ acao: "", prazo: somarDias(hoje, 3), responsavelId: usuarioId });
  const [retomada, setRetomada] = useState(somarDias(hoje, 30));
  const [motivo, setMotivo] = useState("");
  const [naoContatar, setNaoContatar] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const rotulo = (s: string) => ROTULO_SITUACAO[s as Situacao] ?? s;

  async function confirmar() {
    setSalvando(true);
    const r = await moverEmpresa({
      clienteId: alvo.clienteId,
      para: alvo.para,
      proximoPasso: etapaAtiva(alvo.para) ? passo : null,
      retomadaEm: alvo.para === "PAUSADA" ? retomada : null,
      motivo: alvo.para === "DESCARTADA" ? motivo : null,
      naoContatar: alvo.para === "DESCARTADA" ? naoContatar : false,
    });
    setSalvando(false);
    if (r.erros.length > 0) return setErros(r.erros);
    aoFechar(true);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{alvo.nome}</DialogTitle>
        <DialogDescription>
          {rotulo(alvo.de)} → {rotulo(alvo.para)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {etapaAtiva(alvo.para) && <PassoCampos valor={passo} aoMudar={setPasso} responsaveis={responsaveis} />}
        {alvo.para === "PAUSADA" && (
          <CampoTexto rotulo="Retomar em" type="date" value={retomada} onChange={(e) => setRetomada(e.target.value)} dica="Vira um próximo passo na data escolhida." />
        )}
        {alvo.para === "DESCARTADA" && (
          <>
            <CampoTexto rotulo="Motivo" placeholder="Ex.: só vende marca própria" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <CampoCheckbox rotulo="Não contatar mais" dica="Nenhuma mensagem será escrita para esta empresa." marcado={naoContatar} aoMudar={setNaoContatar} />
          </>
        )}
        {alvo.para === "CANDIDATA" && <p className="text-sm text-muted-foreground">A empresa volta para avaliação. Os próximos passos abertos serão encerrados.</p>}
        {erros.length > 0 && (
          <ul className="text-sm text-destructive">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Botao variante="secundario" onClick={() => aoFechar(false)} disabled={salvando}>
          Cancelar
        </Botao>
        <Botao variante="primario" onClick={confirmar} carregando={salvando}>
          Confirmar
        </Botao>
      </DialogFooter>
    </>
  );
}
