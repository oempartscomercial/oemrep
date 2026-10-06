export type ResolucaoClienteNFe =
  | { clienteId: string | null; gravarCnpj: boolean }
  | { erro: string };

// Qual empresa recebe a NFe. O CNPJ do destinatário manda (RN04). Quando nenhuma
// empresa tem esse CNPJ, o usuário escolhe uma empresa sem CNPJ e a conferência grava
// o CNPJ da nota nela — é aqui que o CNPJ passa a ser exigido (ADR-013).
export function resolverClienteDaNFe(
  destinatarioCnpj: string,
  clientePorCnpj: { id: string } | null,
  clienteEscolhido: { id: string; cnpj: string | null } | null,
): ResolucaoClienteNFe {
  if (clientePorCnpj) {
    if (clienteEscolhido && clienteEscolhido.id !== clientePorCnpj.id) {
      return { erro: "O CNPJ desta nota já pertence a outra empresa cadastrada." };
    }
    return { clienteId: clientePorCnpj.id, gravarCnpj: false };
  }

  if (!clienteEscolhido) return { clienteId: null, gravarCnpj: false };
  if (clienteEscolhido.cnpj && clienteEscolhido.cnpj !== destinatarioCnpj) {
    return { erro: "A empresa escolhida tem outro CNPJ cadastrado." };
  }
  return { clienteId: clienteEscolhido.id, gravarCnpj: !clienteEscolhido.cnpj };
}
