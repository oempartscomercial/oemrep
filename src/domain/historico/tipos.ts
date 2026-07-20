export type TipoHistorico = "PEDIDO" | "NFE";

export type TotalMensal = {
  ano: number;
  mes: number; // 1-12
  fabricaNome: string;
  valor: number;
};
