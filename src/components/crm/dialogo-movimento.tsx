"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoCheckbox, CampoTexto } from "@/components/patterns/campo";
import { PassoCampos, type PassoForm } from "./passo-campos";
import { moverEmpresa } from "@/app/(app)/empresas/actions";
import { moverOportunidade } from "@/app/(app)/funis/actions";
import { etapaAtiva, ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";
import { etapaAtivaOp, ROTULO_ETAPA_OP, type EtapaOportunidade } from "@/domain/crm/oportunidade";
import { hojeEmSaoPaulo, somarDias } from "@/domain/crm/prazo";

/** `id` é a empresa (modo "empresa") ou a oportunidade (modo "oportunidade"). */
export type AlvoMovimento = { id: string; nome: string; de: string; para: string };
export type ModoMovimento = "empresa" | "oportunidade";

/**
 * Janelinha de mudança de etapa: pede o que a regra do funil exige (próximo passo,
 * retomada ou motivo). Cancelar não grava nada; quem abre devolve o card ao lugar.
 */
export function DialogoMovimento({
  modo = "empresa",
  alvo,
  responsaveis,
  usuarioId,
  aoFechar,
}: {
  modo?: ModoMovimento;
  alvo: AlvoMovimento | null;
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
  aoFechar: (movido: boolean) => void;
}) {
  return (
    <Dialog open={!!alvo} onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent className="sm:max-w-md">
        {/* key reinicia o formulário a cada novo movimento */}
        {alvo && <Formulario key={`${alvo.id}-${alvo.para}`} modo={modo} alvo={alvo} responsaveis={responsaveis} usuarioId={usuarioId} aoFechar={aoFechar} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  modo,
  alvo,
  responsaveis,
  usuarioId,
  aoFechar,
}: {
  modo: ModoMovimento;
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

  const carteira = modo === "oportunidade";
  const rotulo = (s: string) => (carteira ? ROTULO_ETAPA_OP[s as EtapaOportunidade] : ROTULO_SITUACAO[s as Situacao]) ?? s;
  const ativa = carteira ? etapaAtivaOp(alvo.para) : etapaAtiva(alvo.para);
  const pausa = carteira ? "ADIADA" : "PAUSADA";
  const descarte = carteira ? "PERDIDA" : "DESCARTADA";
  const voltaAoInicio = carteira ? "A_ABORDAR" : "CANDIDATA";

  async function confirmar() {
    setSalvando(true);
    const comum = {
      para: alvo.para,
      proximoPasso: ativa ? passo : null,
      retomadaEm: alvo.para === pausa ? retomada : null,
      motivo: alvo.para === descarte ? motivo : null,
    };
    const r = carteira
      ? await moverOportunidade({ id: alvo.id, ...comum })
      : await moverEmpresa({ clienteId: alvo.id, ...comum, naoContatar: alvo.para === "DESCARTADA" ? naoContatar : false });
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
        {ativa && <PassoCampos valor={passo} aoMudar={setPasso} responsaveis={responsaveis} />}
        {alvo.para === pausa && (
          <CampoTexto rotulo="Retomar em" type="date" value={retomada} onChange={(e) => setRetomada(e.target.value)} dica="Vira um próximo passo na data escolhida." />
        )}
        {alvo.para === descarte && (
          <>
            <CampoTexto rotulo="Motivo" placeholder={carteira ? "Ex.: já tem fornecedor dessa linha" : "Ex.: só vende marca própria"} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            {!carteira && <CampoCheckbox rotulo="Não contatar mais" dica="Nenhuma mensagem será escrita para esta empresa." marcado={naoContatar} aoMudar={setNaoContatar} />}
          </>
        )}
        {alvo.para === voltaAoInicio && <p className="text-sm text-muted-foreground">{carteira ? "A oportunidade volta para o início. O próximo passo aberto será encerrado." : "A empresa volta para avaliação. Os próximos passos abertos serão encerrados."}</p>}
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
