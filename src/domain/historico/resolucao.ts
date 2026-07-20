import type { TotalMensal, TipoHistorico } from "./tipos";

export type FabricaCadastrada = { id: string; nome: string };

export type LinhaHistorico = {
  ano: number;
  mes: number;
  fabricaId: string;
  fabricaNome: string;
  tipo: TipoHistorico;
  valor: number;
};

export type ResultadoResolucao = {
  linhas: LinhaHistorico[];
  pendencias: string[];
};

function normalizarNome(nome: string): string {
  return nome.trim().toLowerCase();
}

// Cruza os totais extraídos das planilhas contra as fábricas cadastradas. Nome que não
// casa vira pendência bloqueante (o import não segue enquanto houver pendência) — assim
// uma fábrica ainda não cadastrada nunca entra silenciosamente nem é descartada.
export function resolverFabricas(
  pedidos: TotalMensal[],
  nfe: TotalMensal[],
  fabricas: FabricaCadastrada[],
): ResultadoResolucao {
  const porNome = new Map(fabricas.map((f) => [normalizarNome(f.nome), f]));
  const linhas: LinhaHistorico[] = [];
  const pendencias = new Set<string>();

  const processar = (totais: TotalMensal[], tipo: TipoHistorico) => {
    for (const total of totais) {
      const fabrica = porNome.get(normalizarNome(total.fabricaNome));
      if (!fabrica) {
        pendencias.add(total.fabricaNome);
        continue;
      }
      linhas.push({
        ano: total.ano,
        mes: total.mes,
        fabricaId: fabrica.id,
        fabricaNome: total.fabricaNome,
        tipo,
        valor: total.valor,
      });
    }
  };

  processar(pedidos, "PEDIDO");
  processar(nfe, "NFE");

  return { linhas, pendencias: [...pendencias] };
}
