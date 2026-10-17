import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { UsuarioSessao } from "@/lib/sessao";
import * as consultas from "./consultas";
import * as escritas from "./escritas";
import * as whatsapp from "./whatsapp";

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
- WhatsApp de prospecção: você prepara (preparar_mensagem_whatsapp), mostra ao usuário o destinatário e o texto exato, e só aprova (aprovar_mensagem_whatsapp) depois do OK explícito dele para aquele texto ("pode enviar", "manda"). Nunca aprove por conta própria, nunca mude o texto depois do OK, nunca envie e-mail. As regras do sistema (não contatar, origem do número, horário comercial, limite do dia, duplicada) valem sempre: se bloquear, explique em uma frase.
- Rudolph só no Norte e Nordeste (regra do contrato).
- A prospecção é por fábrica: cada empresa em prospecção tem uma ou mais fábricas ("prospecção para"); a etapa do funil é uma só por empresa. Quando o usuário disser com que fábrica vai trabalhar ("hoje é Rudolph"), use o filtro fabrica em agenda e buscar_empresas. Empresa nova: pergunte a fábrica se ele não disser.
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
const fabrica = z.string().optional().describe("Nome da fábrica (ex.: Rudolph, Bowden, Seineca/H3). Mostra só o que é dessa fábrica.");
const fabricas = (o: string) => z.array(z.string().min(1)).optional().describe(`${o} Nomes das fábricas, ex.: ["Rudolph"].`);
const SITUACOES = ["candidata", "aprovada", "em_contato", "conversando", "avanco", "pausada", "descartada"] as const;

export function criarServidorMcp(usuario: UsuarioSessao): McpServer {
  const server = new McpServer({ name: "oem-crm", version: "1.0.0" }, { instructions: INSTRUCOES });

  server.registerTool(
    "agenda",
    {
      title: "Agenda do dia",
      description:
        "O que fazer hoje: próximos passos atrasados, de hoje e dos próximos 7 dias (com responsável e dia da semana), empresas em andamento sem próximo passo, empresas esperando avaliação e respostas no WhatsApp. Use quando o usuário disser 'bom dia', 'o que eu faço hoje?', 'minha agenda', 'tem algo atrasado?'. Com fabrica, só o que é daquela fábrica (prospecção dela e oportunidades da carteira dela). Cada passo traz o id para concluir_proximo_passo.",
      inputSchema: { fabrica },
      annotations: LEITURA,
    },
    async (a) => texto(await consultas.agenda(a)),
  );

  server.registerTool(
    "buscar_empresas",
    {
      title: "Buscar empresas",
      description:
        "Procura empresas (clientes e prospecção) por nome, CNPJ, site, cidade ou nome de contato, com filtros opcionais de situação e de fábrica. Use para achar a empresa certa antes de ver ou gravar, ou para listar por situação e fábrica (ex.: todas 'candidata' da Rudolph = esperando avaliação na Rudolph).",
      inputSchema: {
        texto: z.string().optional().describe("Parte do nome, CNPJ, site, cidade ou nome de contato."),
        situacao: z.enum([...SITUACOES, "cliente"]).optional().describe("candidata = a avaliar; cliente = carteira atual."),
        fabrica: z.string().optional().describe("Nome da fábrica: empresas em prospecção para ela (ou clientes que a compram)."),
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
        "Ficha completa: dados, situação, fábricas da prospecção ('prospecção para') ou fábricas que compra (cliente), próximos passos (com id), contatos (canal, valor, fonte, origem, não contatar), últimas interações, pedidos recebidos da planilha (não é faturamento), pedidos lançados e WhatsApp. Use para 'me mostra a X', 'o que tenho da X?'.",
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
    "preparar_mensagem_whatsapp",
    {
      title: "Preparar mensagem de WhatsApp",
      description:
        "Cria um RASCUNHO de mensagem de WhatsApp para um contato cadastrado de uma empresa (nada é enviado). Devolve o destinatário, o texto exato, o tipo e o que impediria ou seguraria o envio (não contatar, origem do número, horário comercial, limite do dia, mensagem repetida). Depois de chamar: mostre ao usuário o destinatário e o texto exato e pergunte se pode enviar (agora ou quando). Só aprove depois do OK explícito dele para AQUELE texto. Primeira mensagem: curta, sem link, citando algo real do catálogo da empresa e com pergunta sobre quem compra (modelo do usuário). Só para contato cadastrado com fonte; nunca deduza número.",
      inputSchema: {
        empresa,
        contato: z.string().optional().describe("Nome do contato na empresa (ou o número). Vazio = o único contato de telefone da empresa."),
        numero: z.string().optional().describe("Número com DDD, se o usuário disse o número. Precisa já estar cadastrado na empresa."),
        texto: z.string().min(1).describe("Texto exato da mensagem, como o usuário vai ver e aprovar."),
        tipo: z
          .enum(["primeiro_contato", "follow_up", "resposta"])
          .optional()
          .describe("Vazio = o sistema deduz pela conversa (nada ainda = primeiro contato; o contato falou por último = resposta; senão follow-up)."),
      },
      annotations: ESCRITA,
    },
    async (a) => texto(await whatsapp.prepararMensagemWhatsapp(usuario, a)),
  );

  server.registerTool(
    "aprovar_mensagem_whatsapp",
    {
      title: "Aprovar e enviar (ou agendar) mensagem de WhatsApp",
      description:
        "Aprova um rascunho em nome do usuário (fica registrado que foi aprovado pelo Claude a pedido dele) e envia agora ou agenda. SÓ CHAME depois que o usuário viu o texto exato e o destinatário e disse explicitamente que pode enviar. Uma chamada por mensagem. O sistema ainda aplica as proteções: devolve ENVIADA, AGENDADA para …, APROVADA esperando (horário, conexão, limite do dia: sai sozinha depois) ou BLOQUEADA por … (cancelada). Fora do horário comercial, a agendada espera a próxima abertura.",
      inputSchema: {
        mensagem_id: z.string().min(1).describe("O [mensagem_id: …] devolvido por preparar_mensagem_whatsapp ou mensagens_whatsapp."),
        enviar_em: z.string().optional().describe('Quando enviar: "agora" (padrão), "amanhã 9h", "segunda 14h", "23/10 9h" ou DD/MM/AAAA HH:MM (horário de Brasília). Até 30 dias à frente.'),
      },
      annotations: { ...ESCRITA, openWorldHint: true },
    },
    async (a) => texto(await whatsapp.aprovarMensagemWhatsapp(usuario, a)),
  );

  server.registerTool(
    "cancelar_mensagem_whatsapp",
    {
      title: "Cancelar mensagem de WhatsApp",
      description: "Cancela um rascunho ou uma mensagem aprovada que ainda não saiu (inclusive agendada). Use quando o usuário desistir ou quiser trocar o texto (depois prepare outra). O que já saiu não volta.",
      inputSchema: { mensagem_id: z.string().min(1).describe("O [mensagem_id: …] da mensagem.") },
      annotations: { ...ESCRITA, destructiveHint: true },
    },
    async (a) => texto(await whatsapp.cancelarMensagemWhatsapp(usuario, a)),
  );

  server.registerTool(
    "mensagens_whatsapp",
    {
      title: "Mensagens de WhatsApp pendentes",
      description:
        "O que está pendente no WhatsApp de prospecção: rascunhos esperando aprovação, aprovadas que ainda não saíram (agendadas ou esperando), enviadas hoje e respostas de contatos esperando retorno. Use para 'alguém respondeu?', 'o que falta aprovar?', 'o que saiu hoje?'. Sem filtro, mostra tudo.",
      inputSchema: { filtro: z.enum(["rascunhos", "agendadas", "enviadas_hoje", "respostas"]).optional() },
      annotations: LEITURA,
    },
    async (a) => texto(await whatsapp.mensagensWhatsapp(a)),
  );

  server.registerTool(
    "status_whatsapp",
    {
      title: "WhatsApp conectado?",
      description: "Diz se o celular de prospecção está conectado (e com qual número), se o envio automático está ligado, se as respostas estão chegando ao sistema e quantas mensagens esperam. Use para 'o WhatsApp caiu?', 'está conectado?'. Se estiver desconectado, oriente o usuário a pedir ao Arthur ou abrir a tela Integrações para ler o QR Code.",
      annotations: { ...LEITURA, openWorldHint: true },
    },
    async () => texto(await whatsapp.statusWhatsapp()),
  );

  server.registerTool(
    "registrar_interacao",
    {
      title: "Registrar o que aconteceu",
      description:
        "Anota um contato com a empresa (ligação, WhatsApp, e-mail, visita, reunião) e define o próximo passo. Também muda a situação da prospecção, inclui ou tira fábricas da prospecção, marca 'não contatar' e cadastra um contato novo que apareceu na conversa. Use para 'liguei pra…', 'falei com…', 'a X respondeu', 'anota aí'. Confirme com o usuário antes. Empresa em andamento exige proximo_passo (ou sem_proximo_passo, se o usuário disser que não há).",
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
        incluir_fabricas: fabricas("Fábricas para as quais a empresa passa a ser prospectada (não vale para cliente)."),
        tirar_fabricas: fabricas("Fábricas que deixam de ser prospectadas nesta empresa."),
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
        "Cadastra uma empresa nova em prospecção, que entra como 'a avaliar', já com a(s) fábrica(s) da prospecção. Confere duplicidade por CNPJ e por nome parecido; se houver parecida, mostra e só cadastra com mesmo_assim depois que o usuário confirmar. Nunca invente CNPJ, site ou cidade. Rudolph só no Norte e Nordeste.",
      inputSchema: {
        nome: z.string().min(1),
        uf: z.string().optional().describe("Sigla do estado, ex.: PE."),
        cidade: z.string().optional(),
        cnpj: z.string().optional(),
        site: z.string().optional(),
        observacoes: z.string().optional().describe("O que se sabe da empresa e de onde veio (ex.: catálogo de transmissão agrícola no site)."),
        fabricas: fabricas("Para qual fábrica (ou quais) é a prospecção. Se o usuário não disse, pergunte."),
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
