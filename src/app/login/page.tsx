"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase";
import { validarAcesso } from "./actions";
import { traduzirErroAuth } from "@/domain/auth/mensagens";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Botao } from "@/components/patterns/botao";
import { CampoTexto } from "@/components/patterns/campo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) {
      setErro(traduzirErroAuth(error));
      setEnviando(false);
      return;
    }
    const acesso = await validarAcesso();
    if (!acesso.ok) {
      await supabase.auth.signOut();
      setErro(acesso.mensagem);
      setEnviando(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthLayout titulo="Entrar" subtitulo="Acesse a plataforma de representação comercial">
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
        <CampoTexto
          obrigatorio
          rotulo="Senha"
          type="password"
          name="senha"
          autoComplete="current-password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <Botao type="submit" variante="primario" carregando={enviando} className="w-full">
          Entrar
        </Botao>
        <Link href="/login/recuperar" className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Esqueci minha senha
        </Link>
      </form>
    </AuthLayout>
  );
}
