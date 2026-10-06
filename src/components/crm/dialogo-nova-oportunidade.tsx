"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTextarea } from "@/components/patterns/campo";
import { criarOportunidade } from "@/app/(app)/funis/actions";
import { ROTULO_TIPO_OP } from "@/domain/crm/oportunidade";

export type ClienteOpcao = { id: string; nome: string; fabricaIds: string[] };
export type FabricaOpcao = { id: string; nome: string };

/**
 * Nova oportunidade da carteira. O tipo vem do cadastro: se o cliente já compra a fábrica, é
 * "Reativar"; se não compra, "Vender fábrica nova".
 */
export function DialogoNovaOportunidade({
  aberto,
  aoFechar,
  clientes,
  fabricas,
  clienteInicial,
  fabricaInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  clientes: ClienteOpcao[];
  fabricas: FabricaOpcao[];
  clienteInicial?: string;
  fabricaInicial?: string;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        {aberto && <Formulario key={`${clienteInicial}-${fabricaInicial}`} aoFechar={aoFechar} clientes={clientes} fabricas={fabricas} clienteInicial={clienteInicial} fabricaInicial={fabricaInicial} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ aoFechar, clientes, fabricas, clienteInicial, fabricaInicial }: Omit<Parameters<typeof DialogoNovaOportunidade>[0], "aberto">) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const [fabricaId, setFabricaId] = useState(fabricaInicial ?? "");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const cliente = clientes.find((c) => c.id === clienteId);
  const tipo = cliente && fabricaId ? (cliente.fabricaIds.includes(fabricaId) ? "REATIVAR" : "VENDER_FABRICA_NOVA") : null;

  async function salvar() {
    if (!tipo) return setErros(["Escolha o cliente e a fábrica."]);
    setSalvando(true);
    const r = await criarOportunidade({ clienteId, fabricaId, tipo, observacoes });
    setSalvando(false);
    if (r.erros.length) return setErros(r.erros);
    aoFechar();
    router.refresh();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nova oportunidade</DialogTitle>
        <DialogDescription>Um cliente e uma fábrica que vale a pena oferecer.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <CampoSelect rotulo="Cliente" name="op-cliente" placeholder="Escolha o cliente…" opcoes={clientes.map((c) => ({ id: c.id, label: c.nome }))} valor={clienteId} aoMudar={setClienteId} />
        <CampoSelect
          rotulo="Fábrica"
          name="op-fabrica"
          placeholder="Escolha a fábrica…"
          opcoes={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
          valor={fabricaId}
          aoMudar={setFabricaId}
          dica={tipo ? `${ROTULO_TIPO_OP[tipo]}${tipo === "REATIVAR" ? ": o cliente já comprou essa fábrica" : ": o cliente ainda não compra essa fábrica"}.` : undefined}
        />
        <CampoTextarea rotulo="Observação (opcional)" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        {erros.length > 0 && <ul className="text-sm text-destructive">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
      </div>
      <DialogFooter>
        <Botao onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
        <Botao variante="primario" onClick={salvar} carregando={salvando}>Criar</Botao>
      </DialogFooter>
    </>
  );
}
