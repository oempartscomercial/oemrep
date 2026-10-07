"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, MessageSquarePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTexto, CampoTextarea } from "@/components/patterns/campo";
import { PassoCampos, type PassoForm } from "@/components/crm/passo-campos";
import { DialogoMovimento, type AlvoMovimento } from "@/components/crm/dialogo-movimento";
import { concluirProximoPasso, registrarInteracao } from "../actions";
import { etapaAtiva, ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";
import { hojeEmSaoPaulo, somarDias } from "@/domain/crm/prazo";

type Responsavel = { id: string; nome: string };
type Props = {
  clienteId: string;
  nome: string;
  situacao: string;
  passoAbertoId: string | null;
  responsaveis: Responsavel[];
  usuarioId: string;
};

const CANAIS = [
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "TELEFONE", label: "Ligação" },
  { id: "EMAIL", label: "E-mail" },
  { id: "VISITA", label: "Visita" },
  { id: "REUNIAO", label: "Reunião" },
  { id: "OUTRO", label: "Outro" },
];
const DESTINOS: Situacao[] = ["CANDIDATA", "APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO", "PAUSADA", "DESCARTADA"];

const novoPasso = (usuarioId: string): PassoForm => ({ acao: "", prazo: somarDias(hojeEmSaoPaulo(), 3), responsavelId: usuarioId });

export function FichaAcoes({ clienteId, nome, situacao, passoAbertoId, responsaveis, usuarioId }: Props) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<"contato" | "passo" | null>(null);
  const [movimento, setMovimento] = useState<AlvoMovimento | null>(null);
  const ativa = etapaAtiva(situacao);
  const podeMover = situacao !== "CLIENTE";

  function fechar() {
    setDialogo(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao className="h-10 md:h-8" variante="primario" icone={<MessageSquarePlus />} onClick={() => setDialogo("contato")}>
        Registrar contato
      </Botao>
      {passoAbertoId && (
        <Botao className="h-10 md:h-8" icone={<Check />} onClick={() => setDialogo("passo")}>
          Concluir passo
        </Botao>
      )}
      {!passoAbertoId && (
        <Botao className="h-10 md:h-8" onClick={() => setDialogo("passo")}>Marcar próximo passo</Botao>
      )}
      {podeMover && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Botao className="h-10 md:h-8" icone={<ArrowRightLeft />}>Mover etapa</Botao>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {DESTINOS.filter((d) => d !== situacao).map((d) => (
              <DropdownMenuItem key={d} onSelect={() => setMovimento({ id: clienteId, nome, de: situacao, para: d })}>
                {ROTULO_SITUACAO[d]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {dialogo === "contato" && <DialogoContato clienteId={clienteId} nome={nome} exigePasso={ativa && !passoAbertoId} responsaveis={responsaveis} usuarioId={usuarioId} aoFechar={fechar} />}
      {dialogo === "passo" && (
        <DialogoPasso passoId={passoAbertoId} nome={nome} clienteId={clienteId} exigeProximo={ativa} responsaveis={responsaveis} usuarioId={usuarioId} aoFechar={fechar} />
      )}
      <DialogoMovimento
        alvo={movimento}
        responsaveis={responsaveis}
        usuarioId={usuarioId}
        aoFechar={(movido) => {
          setMovimento(null);
          if (movido) router.refresh();
        }}
      />
    </div>
  );
}

export function DialogoContato({
  clienteId,
  nome,
  oportunidadeId = null,
  exigePasso,
  responsaveis,
  usuarioId,
  aoFechar,
}: {
  clienteId: string;
  nome: string;
  oportunidadeId?: string | null;
  exigePasso: boolean;
  responsaveis: Responsavel[];
  usuarioId: string;
  aoFechar: () => void;
}) {
  const [canal, setCanal] = useState("WHATSAPP");
  const [comQuem, setComQuem] = useState("");
  const [resumo, setResumo] = useState("");
  const [resultado, setResultado] = useState("");
  const [comPasso, setComPasso] = useState(true);
  const [passo, setPasso] = useState<PassoForm>(novoPasso(usuarioId));
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const r = await registrarInteracao({ clienteId, canal, resumo, comQuem, resultado, oportunidadeId, proximoPasso: exigePasso || comPasso ? passo : null });
    setSalvando(false);
    if (r.erros.length) return setErros(r.erros);
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
          <DialogDescription>{nome}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <CampoSelect rotulo="Como foi" name="canal" opcoes={CANAIS} valor={canal} aoMudar={setCanal} />
            <CampoTexto rotulo="Com quem" placeholder="Ex.: Ana, do compras" value={comQuem} onChange={(e) => setComQuem(e.target.value)} />
          </div>
          <CampoTextarea rotulo="O que aconteceu" rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} />
          <CampoTexto rotulo="Resultado" placeholder="Ex.: pediu catálogo" value={resultado} onChange={(e) => setResultado(e.target.value)} />
          {!exigePasso && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={comPasso} onChange={(e) => setComPasso(e.target.checked)} />
              Marcar um novo próximo passo (substitui o atual)
            </label>
          )}
          {(exigePasso || comPasso) && <PassoCampos valor={passo} aoMudar={setPasso} responsaveis={responsaveis} />}
          {erros.length > 0 && <ul className="text-sm text-destructive">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
        <DialogFooter>
          <Botao className="h-10 md:h-8" onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
          <Botao className="h-10 md:h-8" variante="primario" onClick={salvar} carregando={salvando}>Anotar</Botao>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoPasso({
  passoId,
  clienteId,
  nome,
  exigeProximo,
  responsaveis,
  usuarioId,
  aoFechar,
}: {
  passoId: string | null;
  clienteId: string;
  nome: string;
  exigeProximo: boolean;
  responsaveis: Responsavel[];
  usuarioId: string;
  aoFechar: () => void;
}) {
  const [passo, setPasso] = useState<PassoForm>(novoPasso(usuarioId));
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // Sem passo aberto, a janela só marca um passo (uma anotação sem texto de contato).
  const marcando = !passoId;

  async function salvar() {
    setSalvando(true);
    const r = marcando
      ? await registrarInteracao({ clienteId, canal: "OUTRO", resumo: `Próximo passo marcado: ${passo.acao.trim() || "—"}`, proximoPasso: passo })
      : await concluirProximoPasso({ id: passoId, proximo: exigeProximo ? passo : null });
    setSalvando(false);
    if (r.erros.length) return setErros(r.erros);
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{marcando ? "Marcar próximo passo" : "Concluir passo"}</DialogTitle>
          <DialogDescription>{nome}</DialogDescription>
        </DialogHeader>
        {(marcando || exigeProximo) && <PassoCampos valor={passo} aoMudar={setPasso} responsaveis={responsaveis} rotulo={marcando ? "Próximo passo" : "E agora, qual é o próximo passo?"} />}
        {!marcando && !exigeProximo && <p className="text-sm text-muted-foreground">O passo será marcado como feito.</p>}
        {erros.length > 0 && <ul className="text-sm text-destructive">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        <DialogFooter>
          <Botao className="h-10 md:h-8" onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
          <Botao className="h-10 md:h-8" variante="primario" onClick={salvar} carregando={salvando}>Confirmar</Botao>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
