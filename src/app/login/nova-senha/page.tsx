"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase";
import { traduzirErroAuth } from "@/domain/auth/mensagens";
import { ehConvite, interpretarLinkDeAcesso } from "@/domain/auth/link";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Botao } from "@/components/patterns/botao";
import { CampoTexto } from "@/components/patterns/campo";
import { validarAcesso } from "../actions";

// Destino dos links de e-mail do Supabase: recuperação de senha e convite. O link chega de
// três jeitos (code na query, tokens no fragmento, ou sessão já aberta por /auth/confirm);
// em todos a pessoa termina com uma sessão e grava a senha.
type Estado =
  | { etapa: "validando" }
  | { etapa: "pronto"; convite: boolean }
  | { etapa: "erro"; mensagem: string };

const SEM_LINK = "Link inválido. Peça um novo link.";
// Token ou code que o Supabase recusa quase sempre é link vencido ou já usado.
const LINK_RECUSADO = "Este link expirou ou já foi usado. Peça um novo.";

export default function NovaSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ etapa: "validando" });
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const { search, hash } = window.location;
    const convite = ehConvite(search, hash);
    const link = interpretarLinkDeAcesso(search, hash);
    const supabase = criarClienteNavegador();
    let ativo = true;
    const terminar = (e: Estado) => ativo && setEstado(e);

    async function validar() {
      if (link.tipo === "erro") return terminar({ etapa: "erro", mensagem: link.mensagem });
      if (link.tipo === "codigo") {
        const { error } = await supabase.auth.exchangeCodeForSession(link.codigo);
        return terminar(error ? { etapa: "erro", mensagem: LINK_RECUSADO } : { etapa: "pronto", convite });
      }
      if (link.tipo === "tokens") {
        const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
        // Tira os tokens da barra de endereço: não devem ficar no histórico nem ser copiados.
        window.history.replaceState(null, "", window.location.pathname + (convite ? "?tipo=convite" : ""));
        return terminar(error ? { etapa: "erro", mensagem: LINK_RECUSADO } : { etapa: "pronto", convite });
      }
      // Sem nada na URL: vale se /auth/confirm já abriu a sessão no servidor.
      const { data } = await supabase.auth.getSession();
      terminar(data.session ? { etapa: "pronto", convite } : { etapa: "erro", mensagem: SEM_LINK });
    }
    void validar();
    return () => {
      ativo = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setEnviando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.updateUser({ password: senha });
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

  const convite = estado.etapa === "pronto" && estado.convite;
  return (
    <AuthLayout
      titulo={convite ? "Bem-vindo! Crie sua senha" : "Criar senha nova"}
      subtitulo={convite ? "É com ela que você vai entrar na plataforma" : undefined}
    >
      {estado.etapa === "erro" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-destructive" role="alert">{estado.mensagem}</p>
          <Link href="/login/recuperar" className="inline-flex min-h-10 items-center justify-center text-center text-sm md:min-h-0 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Pedir novo link
          </Link>
        </div>
      ) : estado.etapa === "validando" ? (
        <p className="text-center text-sm text-muted-foreground">Validando o link…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CampoTexto obrigatorio rotulo="Senha" type="password" name="senha" autoComplete="new-password" minLength={8} dica="Pelo menos 8 caracteres." value={senha} onChange={(e) => setSenha(e.target.value)} />
          <CampoTexto
            obrigatorio
            rotulo="Repita a senha"
            type="password"
            name="confirmacao"
            autoComplete="new-password"
            minLength={8}
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
          {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
          <Botao type="submit" variante="primario" carregando={enviando} className="w-full h-11 md:h-8">
            {convite ? "Criar senha e entrar" : "Salvar senha"}
          </Botao>
        </form>
      )}
    </AuthLayout>
  );
}
