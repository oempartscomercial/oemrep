"use client";

import { useState } from "react";
import { Botao } from "@/components/patterns/botao";

/** Envia (ou reenvia) o convite por e-mail: a pessoa recebe um link para criar a senha. */
export function ConvidarUsuario({
  email,
  acao,
}: {
  email: string;
  acao: () => Promise<{ erros: string[] }>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setEnviando(true);
    setEnviado(false);
    const resultado = await acao();
    setEnviando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    setErro(null);
    setEnviado(true);
  }

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Acesso</h2>
      <p className="text-sm text-muted-foreground">
        Envia um e-mail para <span className="font-medium text-foreground">{email}</span> com o link para criar a senha. Serve também
        para reenviar se o link anterior venceu.
      </p>
      {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
      {enviado && <p className="text-sm text-foreground" role="status">Convite enviado. O link chega em alguns minutos.</p>}
      <div>
        <Botao type="button" variante="secundario" carregando={enviando} onClick={enviar}>
          {enviado ? "Reenviar convite" : "Enviar convite"}
        </Botao>
      </div>
    </div>
  );
}
