"use client";

import { useState } from "react";
import Link from "next/link";
import { pedirRecuperacaoDeSenha } from "../actions";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Botao } from "@/components/patterns/botao";
import { CampoTexto } from "@/components/patterns/campo";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await pedirRecuperacaoDeSenha(email);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    setEnviado(true);
  }

  return (
    <AuthLayout titulo="Recuperar senha" subtitulo="Enviamos um link para você criar uma senha nova">
      {enviado ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/80">
            Se <span className="font-medium text-foreground">{email}</span> estiver cadastrado, o link chega em alguns minutos.
            Confira também a caixa de spam.
          </p>
          <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Voltar para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CampoTexto
            obrigatorio
            rotulo="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Botao type="submit" variante="primario" carregando={enviando} className="w-full">
            Enviar link
          </Botao>
          <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Voltar para o login
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
