import { traduzirErroAuth } from "@/domain/auth/mensagens";

// Parte do cliente admin que o convite usa; permite testar sem rede.
export type ClienteDeConvite = {
  auth: {
    admin: {
      inviteUserByEmail(email: string, opcoes: { redirectTo: string; data?: Record<string, unknown> }): Promise<{ error: { message: string; status?: number; code?: string } | null }>;
    };
  };
};

export type ResultadoConvite = { ok: true } | { ok: false; mensagem: string };

// Convida por e-mail quem já está cadastrado em Usuario (ADR-010). O link leva a
// /login/nova-senha, onde a pessoa cria a senha; o vínculo com o cadastro continua sendo
// feito no primeiro acesso, pelo e-mail.
export async function enviarConvite(cliente: ClienteDeConvite | null, email: string, origem: string, nome?: string): Promise<ResultadoConvite> {
  if (!cliente) {
    return { ok: false, mensagem: "O envio de convites não está configurado neste ambiente (falta a chave de serviço do Supabase)." };
  }
  const { error } = await cliente.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origem}/login/nova-senha?tipo=convite`,
    ...(nome ? { data: { nome } } : {}),
  });
  if (!error) return { ok: true };
  if (error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message)) {
    return { ok: false, mensagem: "Esta pessoa já tem login. Peça para usar “Esqueci minha senha” na tela de entrada." };
  }
  return { ok: false, mensagem: traduzirErroAuth(error) };
}
