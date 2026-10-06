"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase";
import { traduzirErroAuth } from "@/domain/auth/mensagens";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";

// Destino do link de recuperação. O Supabase devolve um `code` na URL, trocado aqui
// por uma sessão; com ela a pessoa grava a senha nova e segue logada.
export default function NovaSenhaPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setErroLink("Link inválido. Peça um novo link de recuperação.");
      return;
    }
    criarClienteNavegador()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => (error ? setErroLink(traduzirErroAuth(error)) : setPronto(true)));
  }, []);

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
        <div className="flex flex-col gap-5">
          <p className="text-sm text-error-primary">{erroLink}</p>
          <Link href="/login/recuperar" className="text-center text-sm font-semibold text-brand-secondary hover:text-brand-secondary_hover">
            Pedir novo link
          </Link>
        </div>
      ) : !pronto ? (
        <p className="text-center text-sm text-tertiary">Validando o link…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input isRequired label="Senha nova" type="password" name="senha" autoComplete="new-password" value={senha} onChange={setSenha} />
          <Input
            isRequired
            label="Repita a senha"
            type="password"
            name="confirmacao"
            autoComplete="new-password"
            value={confirmacao}
            onChange={setConfirmacao}
          />
          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <Button type="submit" color="primary" size="lg" isLoading={enviando} className="w-full">
            Salvar senha
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
