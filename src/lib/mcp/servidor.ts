import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { UsuarioSessao } from "@/lib/sessao";
import * as consultas from "./consultas";
import * as escritas from "./escritas";

// Servidor MCP do CRM da OEM: o Claude do usuário lê e grava o CRM pela plataforma, com as
// mesmas regras das telas. Um servidor por requisição (modo sem sessão), já preso ao usuário
// dono do token.

export const INSTRUCOES = `CRM da OEM Rep (representação comercial de peças: Autoflex, Bowden, Seineca/H3, Bendix, Corven e Rudolph).
Você fala com um usuário da OEM (normalmente o Rômulo, dono, que não é técnico). Regras que não mudam:
- Nunca invente dados (empresa, CNPJ, telefone, e-mail, comprador, valor). Se não está no CRM, diga que não sabe.
- Antes de gravar, confirme em uma frase o que vai anotar e espere o "sim". Tudo o que você grava fica no nome do usuário, marcado "pelo Claude".
- Empresa em andamento (aprovada, em contato, conversando, avanço) precisa de próximo passo com data e responsável. Se faltar, pergunte uma vez.
- Pedido recebido não é faturamento: nunca diga "faturou" ou "receita" sobre pedidos.
- "Não contatar" vale na hora (registrar_interacao com nao_contatar).
- Você não envia mensagens: no máximo escreve rascunhos para o usuário enviar.
- Rudolph só no Norte e Nordeste (regra do contrato).
- Responda em português simples, curto, com datas DD/MM/AAAA e dia da semana; não mostre ids ao usuário (use-os só nas chamadas).`;

const texto = (r: consultas.Resposta) => ({ content: [{ type: "text" as const, text: r.texto }], ...(r.erro ? { isError: true } : {}) });
const LEITURA = { readOnlyHint: true, openWorldHint: false } as const;
const ESCRITA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

const empresa = z.string().min(1).describe("Nome, CNPJ, site ou id da empresa (o id vem de buscar_empresas ou ver_empresa).");
const dia = (o: string) => z.string().describe(`${o} Formatos: DD/MM/AAAA, AAAA-MM-DD, DD/MM, "hoje" ou "amanhã".`);
const passo = z
  .object({
    acao: z.string().min(1).describe("O que fazer, ex.: Ligar para a Ana do Compras."),
    prazo: dia("Quando."),
    responsavel: z.string().optional().describe("Nome de quem faz. Vazio = o usuário que está falando com você."),
  })
  .describe("Próximo passo: ação, data e responsável.");
const SITUACOES = ["candidata", "aprovada", "em_contato", "conversando", "avanco", "pausada", "descartada"] as const;

export function criarServidorMcp(usuario: UsuarioSessao): McpServer {
  const server = new McpServer({ name: "oem-crm", version: "1.0.0" }, { instructions: INSTRUCOES });

  server.registerTool(
    "agenda",
    {
      title: "Agenda do dia",
      description:
        "O que fazer hoje: próximos passos atrasados, de hoje e dos próximos 7 dias (com responsável e dia da semana), empresas em andamento sem próximo passo, empresas esperando avaliação e respostas no WhatsApp. Use quando o usuário disser 'bom dia', 'o que eu faço hoje?', 'minha agenda', 'tem algo atrasado?'. Cada passo traz o id para concluir_proximo_passo.",
      annotations: LEITURA,
    },
    async () => texto(await consultas.agenda()),
  );

  server.registerTool(
    "buscar_empresas",
    {
      title: "Buscar empresas",
      description:
        "Procura empresas (clientes e prospecção) por nome, CNPJ, site, cidade ou nome de contato, com filtro opcional de situação. Use para achar a empresa certa antes de ver ou gravar, ou para listar por situação (ex.: todas 'candidata' = esperando avaliação).",
      inputSchema: {
        texto: z.string().optional().describe("Parte do nome, CNPJ, site, cidade ou nome de contato."),
        situacao: z.enum([...SITUACOES, "cliente"]).optional().describe("candidata = a avaliar; cliente = carteira atual."),
      },
      annotations: LEITURA,
    },
    async (a) => texto(await consultas.buscarEmpresas(a)),
  );

  server.registerTool(
    "ver_empresa",
    {
      title: "Ficha da empresa",
      description:
        "Ficha completa: dados, situação, próximos passos (com id), contatos (canal, valor, fonte, origem, não contatar), últimas interações, fábricas que compra, pedidos recebidos da planilha (não é faturamento), pedidos lançados e WhatsApp. Use para 'me mostra a X', 'o que tenho da X?'.",
      inputSchema: { empresa },
      annotations: LEITURA,
    },
    async (a) => texto(await consultas.verEmpresa(usuario, a)),
  );

  server.registerTool(
    "carteira",
    {
      title: "Carteira de clientes",
      description:
        "Análise dos clientes atuais pela planilha de pedidos recebidos: quem compra com frequência e está atrasado em relação ao próprio ritmo, quem comprou 1 ou 2 vezes e não voltou, e fábricas que cada cliente ainda não compra. Com 'cliente', mostra o detalhe de um cliente (total, ritmo, por fábrica). São sinais para conferir, não previsão; pedido recebido não é faturamento.",
      inputSchema: {
        cliente: z.string().optional().describe("Nome ou id de um cliente, para ver só ele."),
        limite: z.number().int().min(1).max(50).optional().describe("Quantos itens por lista (padrão 10)."),
      },
      annotations: LEITURA,
    },
    async (a) => texto(await consultas.carteira(usuario, a)),
  );

  server.registerTool(
    "conversas_recentes",
    {
      title: "Conversas de WhatsApp",
      description:
        "Últimas conversas da linha de WhatsApp de prospecção (só leitura), com as 3 últimas mensagens de cada uma e quem espera resposta. Filtre por empresa para ver só a conversa dela. Não envia nada.",
      inputSchema: {
        empresa: empresa.optional(),
        limite: z.number().int().min(1).max(30).optional().describe("Quantas conversas (padrão 10)."),
      },
      annotations: LEITURA,
    },
    async (a) => texto(await consultas.conversasRecentes(a)),
  );

  server.registerTool(
    "registrar_interacao",
    {
      title: "Registrar o que aconteceu",
      description:
        "Anota um contato com a empresa (ligação, WhatsApp, e-mail, visita, reunião) e define o próximo passo. Também muda a situação da prospecção, marca 'não contatar' e cadastra um contato novo que apareceu na conversa. Use para 'liguei pra…', 'falei com…', 'a X respondeu', 'anota aí'. Confirme com o usuário antes. Empresa em andamento exige proximo_passo (ou sem_proximo_passo, se o usuário disser que não há).",
      inputSchema: {
        empresa,
        canal: z.enum(["whatsapp", "telefone", "email", "visita", "reuniao", "outro"]),
        resumo: z.string().min(1).describe("O que aconteceu, em uma frase."),
        com_quem: z.string().optional().describe("Com quem falou (nome e/ou função)."),
        resultado: z.string().optional().describe("O que ficou combinado ou a resposta."),
        data: dia("Quando aconteceu (padrão: hoje). Não pode ser futura.").optional(),
        situacao: z.enum(SITUACOES).optional().describe("Nova situação da empresa em prospecção (não vale para cliente). Situação em andamento exige proximo_passo; pausada exige retomada_em; descartada exige motivo."),
        motivo: z.string().optional().describe("Motivo do descarte (com situacao descartada)."),
        retomada_em: dia("Quando retomar (com situacao pausada).").optional(),
        proximo_passo: passo.optional(),
        sem_proximo_passo: z.boolean().optional().describe("O usuário disse explicitamente que não há próximo passo: o passo aberto é encerrado."),
        nao_contatar: z.boolean().optional().describe("A empresa pediu para não ser mais contatada: vale na hora para ela e todos os contatos."),
        contato_novo: z
          .object({
            nome: z.string().optional(),
            funcao: z.string().optional(),
            canal: z.enum(["whatsapp", "telefone", "email", "linkedin", "outro"]),
            valor: z.string().min(1).describe("Número com DDD ou e-mail, exatamente como o usuário disse."),
            serve_para: z.string().optional().describe("Para que serve, ex.: compras da linha agrícola."),
            fonte: z.string().optional().describe("De onde veio (URL da página da empresa, 'indicação do João'…). Vazio = o usuário te contou."),
            origem_contato: z.enum(["publicado_pela_empresa", "indicacao", "base_profissional", "relacionamento"]).optional(),
          })
          .optional()
          .describe("Contato novo que apareceu na conversa. Nunca deduza número ou e-mail."),
      },
      annotations: ESCRITA,
    },
    async (a) => texto(await escritas.registrarInteracao(usuario, a)),
  );

  server.registerTool(
    "agendar",
    {
      title: "Marcar próximo passo",
      description: "Define o próximo passo da empresa (substitui o que estiver aberto), sem registrar contato. Use para 'marca pra eu ligar sexta na X'. Responsável padrão: o usuário que está falando.",
      inputSchema: { empresa, acao: passo.shape.acao, prazo: passo.shape.prazo, responsavel: passo.shape.responsavel },
      annotations: ESCRITA,
    },
    async (a) => texto(await escritas.agendar(usuario, a)),
  );

  server.registerTool(
    "concluir_proximo_passo",
    {
      title: "Concluir próximo passo",
      description: "Marca um próximo passo como feito (o id vem de agenda ou ver_empresa). Empresa em andamento precisa já deixar o seguinte em proximo_passo. Para anotar o que aconteceu, prefira registrar_interacao.",
      inputSchema: { passo_id: z.string().min(1).describe("Id do passo ([passo: …] na agenda ou na ficha)."), proximo_passo: passo.optional() },
      annotations: ESCRITA,
    },
    async (a) => texto(await escritas.concluirProximoPasso(usuario, a)),
  );

  server.registerTool(
    "nova_empresa",
    {
      title: "Cadastrar empresa nova",
      description:
        "Cadastra uma empresa nova em prospecção, que entra como 'a avaliar'. Confere duplicidade por CNPJ e por nome parecido; se houver parecida, mostra e só cadastra com mesmo_assim depois que o usuário confirmar. Nunca invente CNPJ, site ou cidade. Rudolph só no Norte e Nordeste.",
      inputSchema: {
        nome: z.string().min(1),
        uf: z.string().optional().describe("Sigla do estado, ex.: PE."),
        cidade: z.string().optional(),
        cnpj: z.string().optional(),
        site: z.string().optional(),
        observacoes: z.string().optional().describe("O que se sabe da empresa e de onde veio (ex.: catálogo de transmissão agrícola no site)."),
        mesmo_assim: z.boolean().optional().describe("Só depois que o usuário confirmar que as parecidas são outras empresas."),
      },
      annotations: ESCRITA,
    },
    async (a) => texto(await escritas.novaEmpresa(usuario, a)),
  );

  server.registerTool(
    "adicionar_contato",
    {
      title: "Adicionar contato",
      description:
        "Cadastra um contato (pessoa ou canal) numa empresa. Todo contato tem fonte: diga de onde veio. Nunca deduza número ou e-mail (nem pelo padrão do domínio).",
      inputSchema: {
        empresa,
        canal: z.enum(["whatsapp", "telefone", "email", "linkedin", "outro"]),
        valor: z.string().min(1).describe("Número com DDD, e-mail ou link."),
        nome: z.string().optional(),
        funcao: z.string().optional(),
        serve_para: z.string().optional(),
        fonte: z.string().optional().describe("De onde veio (URL, 'indicação do João'…). Vazio = o usuário te contou."),
        origem_contato: z
          .enum(["publicado_pela_empresa", "indicacao", "base_profissional", "relacionamento"])
          .optional()
          .describe("Origem do número para WhatsApp. Sem origem, nenhuma mensagem é enviada a ele."),
        observacoes: z.string().optional(),
      },
      annotations: ESCRITA,
    },
    async (a) => texto(await escritas.adicionarContato(usuario, a)),
  );

  return server;
}
