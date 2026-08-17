// Rede de segurança do cliente: se a Server Action rejeitar por qualquer motivo (rede
// caiu, timeout, etc.), a tela não pode ficar parada sem feedback. Extraído do
// componente para poder testar sem infraestrutura de DOM/React.
export async function executarConfirmacaoBaixa(
  confirmar: () => Promise<{ erros: string[] }>,
): Promise<string | null> {
  try {
    const resultado = await confirmar();
    if (resultado.erros.length > 0) return resultado.erros.join(" ");
    return null;
  } catch {
    return "Não foi possível concluir a baixa da NFe. Tente novamente.";
  }
}
