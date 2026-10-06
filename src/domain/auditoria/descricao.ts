// Transforma um evento de auditoria (códigos internos) em texto que uma pessoa lê:
// nome do registro, rótulo do campo e valores traduzidos.

export type NomesAuditoria = {
  // id do registro auditado → como mostrá-lo (ex.: "PED-001 · Bowden · CYRO")
  registros: Record<string, string>;
  // id que aparece como valor (fábrica, cliente) → nome
  valores: Record<string, string>;
};

export type EventoParaDescrever = {
  entidade: string;
  entidadeId: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
};

const ENTIDADES: Record<string, string> = {
  Pedido: "Pedido",
  ItemPedido: "Item de pedido",
  NotaFiscal: "Nota fiscal",
  Cliente: "Cliente",
  Oportunidade: "Oportunidade",
  Fabrica: "Fábrica",
  Usuario: "Usuário",
  HistoricoMensal: "Histórico mensal",
};

const CAMPOS: Record<string, string> = {
  numero: "Número",
  semNumero: "Sem número",
  origem: "Origem",
  fabricaId: "Fábrica",
  clienteId: "Cliente",
  fabricasIds: "Fábricas",
  estado: "Situação",
  status: "Status",
  quantidadeFaturada: "Qtd. faturada",
  chaveAcesso: "Chave de acesso",
  nome: "Nome",
  nomeFantasia: "Nome",
  cnpj: "CNPJ",
  email: "E-mail",
  perfil: "Perfil",
  ativo: "Ativo",
  valor: "Valor",
  situacao: "Etapa",
  naoContatar: "Não contatar",
};

const VALORES: Record<string, string> = {
  SEM_NFE: "Sem NFe",
  PARCIAL: "Parcial",
  COMPLETO: "Completo",
  ARQUIVADO: "Arquivado",
  PENDENTE: "Pendente",
  OK: "OK",
  FORA_DE_FABRICACAO: "Fora de fabricação",
  DESISTENCIA: "Desistência",
  MANUAL: "Manual",
  EXCEL: "Planilha",
  A_ABORDAR: "A abordar",
  ABORDADO: "Abordado",
  INTERESSE: "Com interesse",
  COTACAO: "Cotação",
  GANHA: "Ganha",
  ADIADA: "Adiada",
  PERDIDA: "Perdida",
  CANDIDATA: "A avaliar",
  APROVADA: "Aprovada",
  EM_CONTATO: "Em contato",
  CONVERSANDO: "Conversando",
  AVANCO: "Avanço",
  PAUSADA: "Pausada",
  DESCARTADA: "Descartada",
  CLIENTE: "Cliente",
  ADMIN: "Administrador",
  ANALISTA: "Analista",
  OPERADOR: "Operador",
  true: "Sim",
  false: "Não",
};

const CAMPOS_COM_ID = new Set(["fabricaId", "clienteId"]);

function valor(campo: string, bruto: string | null, nomes: NomesAuditoria): string {
  if (bruto === null || bruto === "") return "—";
  if (CAMPOS_COM_ID.has(campo)) return nomes.valores[bruto] ?? bruto;
  if (campo === "fabricasIds") return bruto.split(",").map((id) => nomes.valores[id] ?? id).join(", ");
  return VALORES[bruto] ?? bruto;
}

export function nomeEntidade(entidade: string): string {
  return ENTIDADES[entidade] ?? entidade;
}

export function descreverEvento(evento: EventoParaDescrever, nomes: NomesAuditoria) {
  return {
    registro: `${nomeEntidade(evento.entidade)} ${nomes.registros[evento.entidadeId] ?? "(removido)"}`,
    campo: CAMPOS[evento.campo] ?? evento.campo,
    de: valor(evento.campo, evento.valorAnterior, nomes),
    para: valor(evento.campo, evento.valorNovo, nomes),
  };
}
