"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/patterns/botao";
import { PageHeader } from "@/components/patterns/page-header";

export type AcaoCadastro = (formData: FormData) => Promise<{ erros: string[] }>;

/** Moldura comum dos formulários de cadastro: envia, mostra erros e volta para a lista. */
export function FormularioCadastro({
  titulo,
  acao,
  voltarPara,
  children,
}: {
  titulo: string;
  acao: AcaoCadastro;
  voltarPara: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    const resultado = await acao(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push(voltarPara);
    router.refresh();
  }

  return (
    <>
      <PageHeader titulo={titulo} />
      <form action={handleSubmit} className="flex max-w-xl flex-col gap-4">
        {children}
        {erros.length > 0 && (
          <ul className="flex flex-col gap-1">{erros.map((e) => <li key={e} className="text-sm text-destructive">{e}</li>)}</ul>
        )}
        <div className="flex gap-2">
          <Botao type="submit" variante="primario">Salvar</Botao>
          <Botao type="button" variante="secundario" href={voltarPara}>Cancelar</Botao>
        </div>
      </form>
    </>
  );
}

/** Desativar/reativar um cadastro (fábrica ou usuário), com o motivo do efeito explicado. */
export function AlternarAtivo({
  ativo,
  acao,
  efeitoAoDesativar,
}: {
  ativo: boolean;
  acao: (ativo: boolean) => Promise<{ erros: string[] }>;
  efeitoAoDesativar: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function alternar() {
    setEnviando(true);
    const resultado = await acao(!ativo);
    setEnviando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    setErro(null);
    router.refresh();
  }

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">{ativo ? "Desativar" : "Inativo"}</h2>
      <p className="text-sm text-muted-foreground">{ativo ? efeitoAoDesativar : "Este cadastro está desativado."}</p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div>
        <Botao type="button" variante={ativo ? "destrutivo" : "secundario"} carregando={enviando} onClick={alternar}>
          {ativo ? "Desativar" : "Reativar"}
        </Botao>
      </div>
    </div>
  );
}
