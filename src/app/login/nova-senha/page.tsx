"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase";
import { traduzirErroAuth } from "@/domain/auth/mensagens";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Botao } from "@/components/patterns/botao";
import { CampoTexto } from "@/components/patterns/campo";

// Destino do link de recuperação. O Supabase devolve um `code` na URL, trocado aqui
// por uma sessão; com ela a pessoa grava a senha nova e segue logada.
export default function NovaSenhaPage() {
  return (
    <Suspense>
      <NovaSenha />
    </Suspense>
  );
}

function NovaSenha() {
  const router = useRouter();
  const code = useSearchParams().get("code");
  const [pronto, setPronto] = useState(false);
  const [erroTroca, setErroTroca] = useState<string | null>(null);
  const erroLink = code ? erroTroca : "Link inválido. Peça um novo link de recuperação.";
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!code) return;
    criarClienteNavegador()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => (error ? setErroTroca(traduzirErroAuth(error)) : setPronto(true)));
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setEnviando(true);
    const { error } = await criarClienteNavegador().auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      setErro(traduzirErroAuth(error));
      return;
    }
    router.push("/");
  }

  return (
    <AuthLayout titulo="Criar senha nova">
      {erroLink ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-destructive">{erroLink}</p>
          <Link href="/login/recuperar" className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Pedir novo link
          </Link>
        </div>
      ) : !pronto ? (
        <p className="text-center text-sm text-muted-foreground">Validando o link…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CampoTexto obrigatorio rotulo="Senha nova" type="password" name="senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <CampoTexto
            obrigatorio
            rotulo="Repita a senha"
            type="password"
            name="confirmacao"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Botao type="submit" variante="primario" carregando={enviando} className="w-full">
            Salvar senha
          </Botao>
        </form>
      )}
    </AuthLayout>
  );
}
