"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/buttons/button";

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
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <h1 className="text-lg font-semibold text-primary">{titulo}</h1>
      {children}
      {erros.length > 0 && (
        <ul className="flex flex-col gap-1">{erros.map((e) => <li key={e} className="text-sm text-error-primary">{e}</li>)}</ul>
      )}
      <div className="flex justify-end gap-3 border-t border-secondary pt-5">
        <Button type="button" color="secondary" href={voltarPara}>Cancelar</Button>
        <Button type="submit" color="primary">Salvar</Button>
      </div>
    </form>
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
    <div className="flex max-w-lg flex-col gap-3 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <h2 className="text-md font-semibold text-primary">{ativo ? "Desativar" : "Inativo"}</h2>
      <p className="text-sm text-tertiary">{ativo ? efeitoAoDesativar : "Este cadastro está desativado."}</p>
      {erro && <p className="text-sm text-error-primary">{erro}</p>}
      <div>
        <Button color={ativo ? "secondary-destructive" : "secondary"} isLoading={enviando} onClick={alternar}>
          {ativo ? "Desativar" : "Reativar"}
        </Button>
      </div>
    </div>
  );
}
