"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";

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
      setErro(error.message);
      setEnviando(false);
      return;
    }
    router.push("/");
  }

  return (
    <AuthLayout titulo="Entrar" subtitulo="Acesse a plataforma de representação comercial">
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
        <Input
          isRequired
          label="Senha"
          type="password"
          name="senha"
          autoComplete="current-password"
          placeholder="••••••••"
          value={senha}
          onChange={setSenha}
        />
        {erro && <p className="text-sm text-error-primary">{erro}</p>}
        <Button type="submit" color="primary" size="lg" isLoading={enviando} className="w-full">
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
