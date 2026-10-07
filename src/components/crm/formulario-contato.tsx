"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTexto, CampoTextarea } from "@/components/patterns/campo";
import { CANAIS_CONTATO, ehCanalTelefone } from "@/domain/crm/contato";
import { criarContato, editarContato } from "@/app/(app)/conversas/actions";

export type ContatoParaEditar = {
  id: string;
  nome: string | null;
  funcao: string | null;
  canal: string;
  valor: string;
  fonte: string;
  observacoes: string | null;
};

const BOTAO_DE_TOQUE = "min-h-10";

/** Dialog de criar ou editar contato. Com `contato`, edita; sem ele, cria na empresa. */
export function FormularioContato({
  clienteId,
  empresa,
  contato,
  numeroTravado = false,
  aoFechar,
}: {
  clienteId: string;
  empresa: string;
  contato?: ContatoParaEditar;
  /** Contato que já tem conversa: número e canal não mudam. */
  numeroTravado?: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(contato?.nome ?? "");
  const [funcao, setFuncao] = useState(contato?.funcao ?? "");
  const [canal, setCanal] = useState(contato?.canal ?? "WHATSAPP");
  const [valor, setValor] = useState(contato?.valor ?? "");
  const [fonte, setFonte] = useState(contato?.fonte ?? "");
  const [observacoes, setObservacoes] = useState(contato?.observacoes ?? "");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const travado = Boolean(contato) && numeroTravado;
  const avisoTravado = "Este número já tem conversa. Para outro número, cadastre um contato novo.";

  async function salvar() {
    setSalvando(true);
    setErros([]);
    const dados = { nome, funcao, canal, valor, fonte, observacoes };
    const r = contato ? await editarContato({ contatoId: contato.id, ...dados }) : await criarContato({ clienteId, ...dados });
    setSalvando(false);
    if (r.erros.length > 0) return setErros(r.erros);
    router.refresh();
    aoFechar();
  }

  const dicaValor = ehCanalTelefone(canal)
    ? "Com DDD. Ex.: (47) 99999-8888"
    : canal === "EMAIL"
      ? "Ex.: nome@empresa.com.br"
      : "Pode ser um link ou uma anotação curta.";

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contato ? "Editar contato" : "Novo contato"}</DialogTitle>
          <DialogDescription>{empresa}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto rotulo="Nome" placeholder="Ex.: Ana, do compras" value={nome} onChange={(e) => setNome(e.target.value)} />
            <CampoTexto rotulo="Função" placeholder="Ex.: Compras" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoSelect
              rotulo="Por onde falar"
              opcoes={CANAIS_CONTATO.map((c) => ({ id: c.id, label: c.label }))}
              valor={canal}
              aoMudar={setCanal}
              desabilitado={travado}
              dica={travado ? avisoTravado : undefined}
            />
            <CampoTexto
              rotulo="Número ou e-mail"
              obrigatorio
              placeholder={ehCanalTelefone(canal) ? "(47) 99999-8888" : undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={travado}
              dica={travado ? avisoTravado : dicaValor}
              inputMode={ehCanalTelefone(canal) ? "tel" : undefined}
            />
          </div>
          <CampoTexto
            rotulo="De onde veio esse contato?"
            obrigatorio
            placeholder="Ex.: Indicação do João"
            dica="Escreva em uma frase. Sem isso o contato não é salvo."
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
          />
          <CampoTextarea
            rotulo="Observações"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />

          {erros.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-destructive">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Botao variante="ghost" className={BOTAO_DE_TOQUE} onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" className={BOTAO_DE_TOQUE} carregando={salvando} onClick={salvar}>
            Salvar
          </Botao>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão "Novo contato" no bloco de contatos da ficha. */
export function BotaoNovoContato({ clienteId, empresa }: { clienteId: string; empresa: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao size="sm" icone={<Plus />} className={BOTAO_DE_TOQUE} onClick={() => setAberto(true)}>
        Novo contato
      </Botao>
      {aberto && <FormularioContato clienteId={clienteId} empresa={empresa} aoFechar={() => setAberto(false)} />}
    </>
  );
}

/** Botão "Editar" de um contato da ficha. */
export function BotaoEditarContato({
  clienteId,
  contato,
  empresa,
  numeroTravado,
}: {
  clienteId: string;
  contato: ContatoParaEditar;
  empresa: string;
  numeroTravado: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao size="sm" variante="ghost" icone={<Pencil />} className={BOTAO_DE_TOQUE} onClick={() => setAberto(true)}>
        Editar
      </Botao>
      {aberto && (
        <FormularioContato
          clienteId={clienteId}
          empresa={empresa}
          contato={contato}
          numeroTravado={numeroTravado}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
