// Mensagens do Supabase Auth em português. A tela nunca mostra o texto técnico em inglês.
const TRADUCOES: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Seu e-mail ainda não foi confirmado. Fale com o administrador."],
  [/password should be at least (\d+)/i, "A senha precisa ter pelo menos $1 caracteres."],
  [/should be different from the old password/i, "A nova senha precisa ser diferente da atual."],
  [/(code verifier|invalid flow state|expired|otp_expired)/i, "Este link expirou ou já foi usado. Peça um novo."],
  [/(for security purposes|rate limit|too many requests)/i, "Muitas tentativas seguidas. Aguarde um pouco e tente de novo."],
];

export function traduzirErroAuth(erro: { message: string; status?: number }): string {
  if (erro.status === 429) return "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.";
  for (const [padrao, mensagem] of TRADUCOES) {
    const casamento = erro.message.match(padrao);
    if (casamento) return mensagem.replace("$1", casamento[1] ?? "");
  }
  return "Não foi possível falar com o servidor agora. Tente de novo.";
}
