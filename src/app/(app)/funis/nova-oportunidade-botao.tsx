"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Botao } from "@/components/patterns/botao";
import { DialogoNovaOportunidade, type ClienteOpcao, type FabricaOpcao } from "@/components/crm/dialogo-nova-oportunidade";

export function NovaOportunidadeBotao({ clientes, fabricas }: { clientes: ClienteOpcao[]; fabricas: FabricaOpcao[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante="primario" icone={<Plus />} onClick={() => setAberto(true)}>
        Nova oportunidade
      </Botao>
      <DialogoNovaOportunidade aberto={aberto} aoFechar={() => setAberto(false)} clientes={clientes} fabricas={fabricas} />
    </>
  );
}
