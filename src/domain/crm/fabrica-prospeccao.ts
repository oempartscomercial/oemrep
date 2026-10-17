import { ufNorteNordeste } from "./regiao";

// Fábrica da prospecção: para qual fábrica cada empresa está sendo prospectada. Usa o mesmo
// vínculo empresa × fábrica do cadastro (ClienteFabrica); a etapa do funil continua uma só por
// empresa. Aqui ficam as regras puras: achar a fábrica pelo nome que o Rômulo fala, ler a
// escolha do filtro do funil e o alerta de região da Rudolph.

type Fabrica = { id: string; nome: string };
export type Resolvida<T> = { ok: true; valor: T } | { ok: false; mensagem: string };

const chave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const partes = (nome: string) => chave(nome).split(/[/\s-]+/).filter(Boolean);

/** Nome falado ("rudolph", "h3", "seineca") ou id → uma fábrica. Nunca escolhe no chute. */
export function acharFabricaPorNome<F extends Fabrica>(texto: string, fabricas: F[]): Resolvida<F> {
  const termo = chave(texto);
  const lista = fabricas.map((f) => f.nome).join(", ");
  if (!termo) return { ok: false, mensagem: `Diga a fábrica. Fábricas: ${lista}.` };
  const porId = fabricas.find((f) => f.id === texto.trim());
  if (porId) return { ok: true, valor: porId };
  const exatas = fabricas.filter((f) => chave(f.nome) === termo || partes(f.nome).includes(termo));
  const achadas = exatas.length > 0 ? exatas : fabricas.filter((f) => chave(f.nome).includes(termo));
  if (achadas.length === 1) return { ok: true, valor: achadas[0] };
  if (achadas.length === 0) return { ok: false, mensagem: `Fábrica "${texto.trim()}" não existe. Fábricas: ${lista}.` };
  return { ok: false, mensagem: `Mais de uma fábrica para "${texto.trim()}": ${achadas.map((f) => f.nome).join(", ")}. Diga o nome completo.` };
}

/** Cookie que guarda a fábrica escolhida no funil entre as visitas. */
export const COOKIE_FABRICA_FUNIL = "oem_funil_fabrica";

/** Filtro do funil de prospecção: uma fábrica, as empresas ainda sem fábrica, ou todas. */
export type FabricaDoFunil = "todas" | "sem" | (string & {});

/** Valor guardado (cookie ou URL) → escolha válida. Fábrica que sumiu ou ficou inativa volta para todas. */
export function lerFabricaDoFunil(valor: string | undefined, fabricas: Fabrica[]): FabricaDoFunil {
  if (valor === "sem") return "sem";
  return fabricas.some((f) => f.id === valor) ? (valor as string) : "todas";
}

/**
 * Rudolph só no Norte e Nordeste (regra do contrato). O alerta vale para a prospecção Rudolph e
 * para a que ainda não tem fábrica (por segurança); prospecção só de outras fábricas não alerta.
 */
export function alertaRegiaoRudolph(uf: string | null | undefined, nomesFabricas: string[]): boolean {
  if (!uf || ufNorteNordeste(uf)) return false;
  return nomesFabricas.length === 0 || nomesFabricas.some((n) => partes(n).includes("rudolph"));
}
