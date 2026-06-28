export function normalizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function digitoVerificador(base: number[], pesos: number[]): number {
  const soma = base.reduce((acc, digito, i) => acc + digito * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(cnpjComOuSemMascara: string): boolean {
  const cnpj = normalizarCnpj(cnpjComOuSemMascara);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digitos = cnpj.split("").map(Number);
  const base12 = digitos.slice(0, 12);

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digito1 = digitoVerificador(base12, pesos1);

  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digito2 = digitoVerificador([...base12, digito1], pesos2);

  return digitos[12] === digito1 && digitos[13] === digito2;
}
