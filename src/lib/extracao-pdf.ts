import Anthropic from "@anthropic-ai/sdk";
import type { ExtracaoBrutaPdf } from "@/domain/importacao/pdf";

/**
 * Adaptador de I/O: manda o PDF para o Claude e recebe os itens estruturados como texto
 * cru — exatamente o formato que `normalizarExtracao` (domínio puro) espera. Toda a regra
 * de negócio fica lá; aqui só existe rede.
 *
 * O modelo é uma variável de ambiente para o dono trocar o degrau de custo sem mudar
 * código. Sem chave configurada, falha com uma mensagem clara em vez de estourar críptico.
 */
const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

// A SEFAZ e os ERPs geram PDF nativo de pedido bem abaixo disto; o teto da API é 32 MB.
const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;

export class ExtracaoPdfIndisponivel extends Error {}
export class ExtracaoPdfRecusada extends Error {}

// A saída é forçada a este schema por tool use com strict: a resposta ou casa exatamente,
// ou o modelo tenta de novo na camada da API. Tudo string, como está impresso no PDF —
// a conversão de número brasileiro é do domínio.
const SCHEMA_PEDIDO = {
  type: "object",
  additionalProperties: false,
  required: ["cabecalho", "itens", "totais"],
  properties: {
    cabecalho: {
      type: "object",
      additionalProperties: false,
      required: ["numeroPedido", "data", "fabricaCnpj", "clienteCnpj"],
      properties: {
        numeroPedido: { type: "string", description: "Número do pedido. Vazio se não houver." },
        data: { type: "string", description: "Data do pedido em dd/mm/aaaa. Vazio se não houver." },
        fabricaCnpj: { type: "string", description: "CNPJ do emitente/fornecedor, como impresso." },
        clienteCnpj: { type: "string", description: "CNPJ do destinatário/cliente, como impresso." },
      },
    },
    itens: {
      type: "array",
      description: "Uma entrada por linha da tabela de itens. Não invente linhas.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["codigo", "descricao", "unidade", "quantidade", "valorUnitario", "valorTotal"],
        properties: {
          codigo: { type: "string", description: "Código/referência do produto, como impresso." },
          descricao: { type: "string" },
          unidade: { type: "string", description: "Unidade (PÇ, CJ, kit...), como impressa." },
          quantidade: { type: "string", description: "Quantidade, exatamente como impressa." },
          valorUnitario: { type: "string", description: "Valor unitário, exatamente como impresso." },
          valorTotal: { type: "string", description: "Valor total da linha, exatamente como impresso." },
        },
      },
    },
    totais: {
      type: "object",
      additionalProperties: false,
      required: ["numeroItens", "somaQuantidades", "totalProdutos"],
      properties: {
        numeroItens: { type: "string", description: "Nº de itens declarado no rodapé. Vazio se não houver." },
        somaQuantidades: { type: "string", description: "Soma das quantidades declarada. Vazio se não houver." },
        totalProdutos: { type: "string", description: "Total de produtos declarado. Vazio se não houver." },
      },
    },
  },
} as const;

const INSTRUCAO =
  "Você extrai pedidos de compra em PDF para conferência. Transcreva os campos EXATAMENTE " +
  "como aparecem no documento — não converta números, não arredonde, não complete o que " +
  "está faltando. Se um campo não existir no PDF, devolva string vazia. Uma entrada por " +
  "linha real da tabela de itens; ignore linhas de total, cabeçalho repetido e rodapé.";

export async function extrairPedidoDoPdf(pdf: Buffer, nomeArquivo: string): Promise<ExtracaoBrutaPdf> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ExtracaoPdfIndisponivel(
      "A leitura automática de PDF ainda não está configurada (falta a chave da IA). Avise o suporte.",
    );
  }
  if (pdf.length > TAMANHO_MAXIMO_BYTES) {
    throw new ExtracaoPdfIndisponivel("O PDF é grande demais para a leitura automática. Envie um arquivo menor.");
  }

  const cliente = new Anthropic();

  let resposta: Anthropic.Message;
  try {
    resposta = await cliente.messages.create({
      model: MODELO,
      max_tokens: 8000,
      // Extração não é tarefa de raciocínio; desligar o pensamento baixa custo e latência.
      thinking: { type: "disabled" },
      tools: [
        {
          name: "registrar_pedido",
          description: "Registra os itens e o cabeçalho lidos do pedido de compra.",
          strict: true,
          input_schema: SCHEMA_PEDIDO as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "registrar_pedido" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
              title: nomeArquivo,
            },
            { type: "text", text: INSTRUCAO },
          ],
        },
      ],
    });
  } catch (erro) {
    if (
      erro instanceof Anthropic.RateLimitError ||
      erro instanceof Anthropic.InternalServerError ||
      erro instanceof Anthropic.APIConnectionError
    ) {
      // Transitórios: a leitura pode dar certo se o operador tentar de novo.
      throw new ExtracaoPdfIndisponivel("A leitura automática está congestionada agora. Tente de novo em instantes.");
    }
    throw erro;
  }

  if (resposta.stop_reason === "refusal") {
    throw new ExtracaoPdfRecusada("Não foi possível ler este arquivo automaticamente. Confira se é o PDF do pedido.");
  }

  const bloco = resposta.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") {
    throw new ExtracaoPdfIndisponivel("A leitura automática não devolveu os itens. Tente de novo.");
  }

  return bloco.input as ExtracaoBrutaPdf;
}
