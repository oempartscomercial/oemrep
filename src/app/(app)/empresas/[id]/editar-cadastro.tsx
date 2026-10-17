"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Botao } from "@/components/patterns/botao";
import { Campo, CampoTexto, CampoTextarea } from "@/components/patterns/campo";
import { editarCadastroEmpresa } from "../actions";
import type { EntradaCadastroEmpresa } from "@/domain/crm/cadastro";

export type CadastroAtual = {
  id: string;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  cidade: string | null;
  site: string | null;
  grupo: string | null;
  origem: string | null;
  observacoes: string | null;
  fabricasIds: string[];
  ehCliente: boolean;
};

/**
 * "Editar cadastro" abre um painel lateral na própria ficha (antes levava para Cadastros,
 * em Administração). Mesmas regras: CNPJ único, auditoria, cliente com ao menos uma fábrica.
 */
export function EditarCadastro({ atual, fabricas, variante = "botao" }: { atual: CadastroAtual; fabricas: { id: string; nome: string; ativo: boolean }[]; variante?: "botao" | "icone" }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {variante === "botao" ? (
        <Botao className="h-11 md:h-8" icone={<Pencil />} onClick={() => setAberto(true)}>
          Editar cadastro
        </Botao>
      ) : (
        <Botao variante="ghost" size="xs" className="h-11 md:h-6" icone={<Pencil />} onClick={() => setAberto(true)}>
          Editar
        </Botao>
      )}
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          {/* key reinicia o formulário com os dados atuais a cada abertura */}
          {aberto && <Formulario key={String(aberto)} atual={atual} fabricas={fabricas} aoFechar={() => setAberto(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Formulario({ atual, fabricas, aoFechar }: { atual: CadastroAtual; fabricas: { id: string; nome: string; ativo: boolean }[]; aoFechar: () => void }) {
  const router = useRouter();
  const [dados, setDados] = useState<EntradaCadastroEmpresa>({
    nome: atual.nome,
    cnpj: atual.cnpj ?? "",
    uf: atual.uf ?? "",
    cidade: atual.cidade ?? "",
    site: atual.site ?? "",
    grupo: atual.grupo ?? "",
    origem: atual.origem ?? "",
    observacoes: atual.observacoes ?? "",
    fabricasIds: atual.fabricasIds,
  });
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const campo = (k: keyof Omit<EntradaCadastroEmpresa, "fabricasIds">) => ({
    name: k,
    value: dados[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDados((d) => ({ ...d, [k]: e.target.value })),
  });
  // Fábrica inativa só aparece se a empresa já estiver ligada a ela.
  const visiveis = fabricas.filter((f) => f.ativo || atual.fabricasIds.includes(f.id));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErros([]);
    const r = await editarCadastroEmpresa(atual.id, dados);
    setSalvando(false);
    if (r.erros.length > 0) return setErros(r.erros);
    toast.success("Cadastro atualizado.");
    aoFechar();
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="flex h-full flex-col">
      <SheetHeader className="border-b px-5 py-4">
        <SheetTitle>Editar cadastro</SheetTitle>
        <SheetDescription>{atual.nome}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <CampoTexto rotulo="Nome" obrigatorio {...campo("nome")} />
        <CampoTexto rotulo="CNPJ" placeholder="00.000.000/0000-00" dica="Opcional. Sem ele, é pedido na conferência da primeira nota." inputMode="numeric" {...campo("cnpj")} />
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <CampoTexto rotulo="Cidade" {...campo("cidade")} />
          <CampoTexto rotulo="UF" placeholder="PE" maxLength={2} className="uppercase" {...campo("uf")} />
        </div>
        <CampoTexto rotulo="Site" placeholder="empresa.com.br" inputMode="url" {...campo("site")} />
        <div className="grid grid-cols-2 gap-3">
          <CampoTexto rotulo="Grupo" {...campo("grupo")} />
          <CampoTexto rotulo="Origem" placeholder="Ex.: pesquisa, indicação" {...campo("origem")} />
        </div>
        <CampoTextarea rotulo="Observações" rows={4} {...campo("observacoes")} />
        <Campo rotulo={atual.ehCliente ? "Fábricas que compra" : "Prospecção para (fábricas)"} dica={atual.ehCliente ? "Cliente precisa de ao menos uma." : "Define em qual funil de fábrica a empresa aparece. Pode marcar mais de uma."}>
          <div role="group" aria-label="Fábricas" className="grid grid-cols-2 gap-2">
            {visiveis.map((f) => (
              <label key={f.id} className="flex min-h-11 items-center gap-2 rounded-md border bg-card px-3 text-sm md:min-h-9">
                <Checkbox
                  checked={dados.fabricasIds.includes(f.id)}
                  onCheckedChange={(marcado) =>
                    setDados((d) => ({ ...d, fabricasIds: marcado ? [...d.fabricasIds, f.id] : d.fabricasIds.filter((x) => x !== f.id) }))
                  }
                />
                {f.nome}
              </label>
            ))}
          </div>
        </Campo>
        {erros.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-destructive">
            {erros.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-3">
        <Botao type="button" variante="ghost" className="h-11 md:h-8" onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
        <Botao type="submit" variante="primario" className="h-11 md:h-8" carregando={salvando}>Salvar</Botao>
      </SheetFooter>
    </form>
  );
}
