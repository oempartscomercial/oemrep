"use client";

import { useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase";
import { traduzirErroAuth } from "@/domain/auth/mensagens";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await criarClienteNavegador().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/nova-senha`,
    });
    setEnviando(false);
    if (error) {
      setErro(traduzirErroAuth(error));
      return;
    }
    setEnviado(true);
  }

  return (
    <AuthLayout titulo="Recuperar senha" subtitulo="Enviamos um link para você criar uma senha nova">
      {enviado ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-secondary">
            Se <span className="font-medium text-primary">{email}</span> estiver cadastrado, o link chega em alguns minutos.
            Confira também a caixa de spam.
          </p>
          <Link href="/login" className="text-center text-sm font-semibold text-brand-secondary hover:text-brand-secondary_hover">
            Voltar para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            isRequired
            label="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            value={email}
            onChange={setEmail}
          />
          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <Button type="submit" color="primary" size="lg" isLoading={enviando} className="w-full">
            Enviar link
          </Button>
          <Link href="/login" className="text-center text-sm font-semibold text-brand-secondary hover:text-brand-secondary_hover">
            Voltar para o login
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
