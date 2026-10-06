// Telefones do WhatsApp. O formato E.164 ("+5547999998888") é a chave da conversa;
// o cadastro do contato é texto livre, então a comparação normaliza os dois lados.

const SUFIXOS_DE_PESSOA = new Set(["s.whatsapp.net", "c.us"]);

// DDD + número local, já sem o 55. Celular tem 9 dígitos começando em 9; fixo tem 8
// começando em 2–5; celulares antigos (sem o 9) têm 8 começando em 6–9.
function numeroBrasilValido(nacional: string): boolean {
  if (!/^[1-9][1-9]\d{8,9}$/.test(nacional)) return false;
  const local = nacional.slice(2);
  return local.length === 9 ? local[0] === "9" : /^[2-9]/.test(local);
}

// Devolve o número em E.164 ou null. Nunca completa nem adivinha: sem o "+", só aceita
// o que dá para ler como número do Brasil. JID de grupo, de status e de "lid" (id
// interno do WhatsApp, sem telefone) não viram número.
export function normalizarTelefone(entrada: string): string | null {
  let texto = entrada.trim();
  if (!texto) return null;

  const arroba = texto.indexOf("@");
  if (arroba >= 0) {
    if (!SUFIXOS_DE_PESSOA.has(texto.slice(arroba + 1))) return null;
    texto = texto.slice(0, arroba).split(":")[0];
  }

  const comMais = texto.startsWith("+");
  const semEnfeite = texto.replace(/[\s().-]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(semEnfeite)) return null;

  if (semEnfeite.startsWith("55") && (semEnfeite.length === 12 || semEnfeite.length === 13)) {
    return numeroBrasilValido(semEnfeite.slice(2)) ? `+${semEnfeite}` : null;
  }
  if (comMais) {
    if (semEnfeite.startsWith("55")) return null;
    return semEnfeite.length >= 8 && semEnfeite.length <= 15 ? `+${semEnfeite}` : null;
  }
  return numeroBrasilValido(semEnfeite) ? `+55${semEnfeite}` : null;
}

// O WhatsApp de contas antigas aparece sem o 9 do celular. No Brasil a identidade do
// número é DDD + os 8 últimos dígitos; fora dele, só o número idêntico.
function chaveDoTelefone(e164: string): string {
  if (!e164.startsWith("+55")) return e164;
  const nacional = e164.slice(3);
  return nacional.slice(0, 2) + nacional.slice(-8);
}

export function mesmoTelefone(a: string, b: string): boolean {
  return chaveDoTelefone(a) === chaveDoTelefone(b);
}

export type ContatoParaCasar = { id: string; clienteId: string; valor: string };

export type ResultadoDoCasamento =
  | { tipo: "unico"; contatoId: string; clienteId: string }
  | { tipo: "varias_empresas"; clienteIds: string[] }
  | { tipo: "nenhum" };

// Liga um número recebido a um contato do cadastro. Número que aparece em mais de uma
// empresa não é atribuído a nenhuma: fica para uma pessoa decidir.
export function casarContato(numero: string, contatos: ContatoParaCasar[]): ResultadoDoCasamento {
  const casados = contatos.filter((c) => {
    const telefone = normalizarTelefone(c.valor);
    return telefone !== null && mesmoTelefone(telefone, numero);
  });
  if (casados.length === 0) return { tipo: "nenhum" };
  const clienteIds = [...new Set(casados.map((c) => c.clienteId))];
  if (clienteIds.length > 1) return { tipo: "varias_empresas", clienteIds };
  return { tipo: "unico", contatoId: casados[0].id, clienteId: casados[0].clienteId };
}
