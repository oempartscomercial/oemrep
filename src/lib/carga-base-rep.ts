import type { Prisma, PrismaClient } from "@prisma/client";
import { mapearConta, mapearContato, mapearInteracao, mapearPedidoHistorico, nomeFabrica, type Linha } from "@/domain/crm/importacao-rep";
import { canalDaLinha, cnpjDoRotulo, indicePorNome, origemDoContato, type ClienteDaPlanilha } from "@/domain/crm/carga-rep";
import { nomeDoCliente } from "@/domain/importacao/acompanhamento";

export type EntradaCargaRep = {
  contas: Linha[];
  contatos: Linha[];
  interacoes: Linha[];
  pedidos: Linha[];
  clientesPlanilha: ClienteDaPlanilha[];
};

export type ResumoCargaRep = {
  fabricasCriadas: string[];
  clientesPlanilhaNovos: number;
  contasCasadasPorCnpj: number;
  contasNovas: number;
  contasJaExistentes: number;
  contasSemCnpj: string[];
  contatosNovos: number;
  interacoesNovas: number;
  proximosPassosNovos: number;
  pedidosHistoricoNovos: number;
  vinculosClienteFabrica: number;
};

const mesmoNome = (nome: string) => ({ equals: nome, mode: "insensitive" as const });

/**
 * Carrega a pasta do Rômulo e os clientes das planilhas do Zé num banco que já tem dados.
 * Casa por CNPJ e por nome, nunca apaga nem sobrescreve o que alguém editou: só preenche
 * campo vazio. Rodar de novo não duplica. Sem `aplicar`, nada é gravado (transação desfeita).
 */
export async function carregarBaseRep(
  prisma: PrismaClient,
  entrada: EntradaCargaRep,
  opcoes: { aplicar: boolean; responsavelPadraoId: string; prazoPadrao: string },
): Promise<ResumoCargaRep> {
  // Tudo é mapeado antes de gravar: valor desconhecido interrompe a carga inteira.
  // Próximo passo sem data recebe o prazo padrão: empresa em andamento sempre tem data (regra 4).
  const contas = entrada.contas.map((l) => ({
    ...mapearConta(l.proxima_acao?.trim() && !l.prazo?.trim() ? { ...l, prazo: opcoes.prazoPadrao } : l),
    rotulos: l.rotulos_planilha ?? "",
  }));
  const contatos = entrada.contatos.map((l) => ({ ...mapearContato({ ...l, canal: canalDaLinha(l.canal) }) }));
  const interacoes = entrada.interacoes.map(mapearInteracao);
  const pedidos = entrada.pedidos.map(mapearPedidoHistorico);
  const indice = indicePorNome(entrada.clientesPlanilha);

  const resumo: ResumoCargaRep = {
    fabricasCriadas: [],
    clientesPlanilhaNovos: 0,
    contasCasadasPorCnpj: 0,
    contasNovas: 0,
    contasJaExistentes: 0,
    contasSemCnpj: [],
    contatosNovos: 0,
    interacoesNovas: 0,
    proximosPassosNovos: 0,
    pedidosHistoricoNovos: 0,
    vinculosClienteFabrica: 0,
  };

  const executar = async (tx: Prisma.TransactionClient) => {
    // Fábricas: as que já existem são achadas pelo nome; as outras entram sem CNPJ.
    const fabricaId = new Map<string, string>();
    const nomesFabrica = new Set([
      ...pedidos.map((p) => nomeFabrica(p.fabricante)),
      ...entrada.clientesPlanilha.flatMap((c) => c.fabricas),
    ]);
    for (const nome of nomesFabrica) {
      const existente = await tx.fabrica.findFirst({ where: { nome: mesmoNome(nome) } });
      if (existente) {
        fabricaId.set(nome, existente.id);
        continue;
      }
      const nova = await tx.fabrica.create({ data: { nome, cnpj: null } });
      fabricaId.set(nome, nova.id);
      resumo.fabricasCriadas.push(nome);
    }
    const idDaFabrica = (fabricante: string) => fabricaId.get(nomeFabrica(fabricante)) ?? fabricaId.get(fabricante)!;

    const vinculos = new Set<string>();

    // Clientes das planilhas do Zé, pelo CNPJ.
    const clientePorCnpj = new Map<string, string>();
    for (const c of entrada.clientesPlanilha) {
      let cliente = await tx.cliente.findUnique({ where: { cnpj: c.cnpj }, select: { id: true } });
      if (!cliente) {
        const dados = nomeDoCliente(c.cnpj, c.nomes[0] ?? c.cnpj);
        cliente = await tx.cliente.create({
          data: { cnpj: c.cnpj, nomeFantasia: dados.nomeFantasia, uf: dados.uf, situacao: "CLIENTE", origem: "planilha de acompanhamento" },
          select: { id: true },
        });
        resumo.clientesPlanilhaNovos++;
      }
      clientePorCnpj.set(c.cnpj, cliente.id);
      for (const f of c.fabricas) vinculos.add(`${cliente.id}|${fabricaId.get(f)}`);
    }

    // Contas da pasta: cliente casa pelo CNPJ (via rótulo da planilha); prospecção pelo CNPJ ou nome.
    const clienteDaConta = new Map<string, string>();
    for (const conta of contas) {
      const { chave, proximoPasso, rotulos, ...dados } = conta;
      const cnpj = dados.cnpj ?? (dados.situacao === "CLIENTE" ? cnpjDoRotulo(rotulos || dados.nomeFantasia, indice) : null);
      let existente = cnpj
        ? await tx.cliente.findUnique({ where: { cnpj } })
        : await tx.cliente.findFirst({ where: { nomeFantasia: mesmoNome(dados.nomeFantasia) } });
      if (!existente && !cnpj) {
        // Já carregada antes sem CNPJ, pelo mesmo nome.
        existente = await tx.cliente.findFirst({ where: { nomeFantasia: mesmoNome(dados.nomeFantasia), origem: "pasta rep" } });
      }

      if (existente) {
        if (cnpj && clientePorCnpj.get(cnpj) === existente.id) resumo.contasCasadasPorCnpj++;
        else resumo.contasJaExistentes++;
        // Só preenche o que está vazio: nada do que alguém editou é sobrescrito.
        const preencher: Prisma.ClienteUpdateInput = {};
        if (!existente.uf && dados.uf) preencher.uf = dados.uf;
        if (!existente.cidade && dados.cidade) preencher.cidade = dados.cidade;
        if (!existente.site && dados.site) preencher.site = dados.site;
        if (!existente.grupo && dados.grupo) preencher.grupo = dados.grupo;
        if (!existente.observacoes && dados.observacoes) preencher.observacoes = dados.observacoes;
        if (Object.keys(preencher).length) await tx.cliente.update({ where: { id: existente.id }, data: preencher });
        clienteDaConta.set(chave, existente.id);
      } else {
        const novo = await tx.cliente.create({ data: { ...dados, cnpj, origem: "pasta rep" } });
        clienteDaConta.set(chave, novo.id);
        resumo.contasNovas++;
        if (dados.situacao === "CLIENTE" && !cnpj) resumo.contasSemCnpj.push(dados.nomeFantasia);
      }

      if (proximoPasso) {
        const clienteId = clienteDaConta.get(chave)!;
        const ja = await tx.proximoPasso.findFirst({ where: { clienteId, acao: proximoPasso.acao, prazo: proximoPasso.prazo } });
        if (!ja) {
          const responsavel = await tx.usuario.findFirst({ where: { nome: mesmoNome(proximoPasso.dono), ativo: true }, select: { id: true } });
          await tx.proximoPasso.create({
            data: { clienteId, acao: proximoPasso.acao, prazo: proximoPasso.prazo, responsavelId: responsavel?.id ?? opcoes.responsavelPadraoId },
          });
          resumo.proximosPassosNovos++;
        }
      }
    }

    const idDaConta = (chave: string, onde: string) => {
      const id = clienteDaConta.get(chave);
      if (!id) throw new Error(`${onde}: conta ${chave} não existe em contas.csv`);
      return id;
    };

    for (const { chaveConta, ...dados } of contatos) {
      const clienteId = idDaConta(chaveConta, "contato");
      const ja = await tx.contato.findFirst({ where: { clienteId, canal: dados.canal, valor: dados.valor, nome: dados.nome } });
      if (ja) continue;
      await tx.contato.create({ data: { ...dados, clienteId, origemContato: origemDoContato(dados) } });
      resumo.contatosNovos++;
    }

    for (const { chaveConta, ...dados } of interacoes) {
      const clienteId = idDaConta(chaveConta, "interação");
      const ja = await tx.interacao.findFirst({ where: { clienteId, data: dados.data, resumo: dados.resumo } });
      if (ja) continue;
      await tx.interacao.create({ data: { ...dados, origem: "IMPORTACAO", clienteId } });
      resumo.interacoesNovas++;
    }

    const linhasJaCarregadas = new Set(
      (await tx.pedidoHistorico.findMany({ select: { linhaPlanilha: true } })).map((p) => p.linhaPlanilha),
    );
    const novosHistorico = [];
    for (const { chaveConta, fabricante, ...dados } of pedidos) {
      const clienteId = idDaConta(chaveConta, `pedido da linha ${dados.linhaPlanilha}`);
      const fId = idDaFabrica(fabricante);
      if (dados.tipo === "PEDIDO" && !dados.suspeitaDuplicidade) vinculos.add(`${clienteId}|${fId}`);
      if (linhasJaCarregadas.has(dados.linhaPlanilha)) continue;
      novosHistorico.push({ ...dados, clienteId, fabricaId: fId });
    }
    if (novosHistorico.length) await tx.pedidoHistorico.createMany({ data: novosHistorico });
    resumo.pedidosHistoricoNovos = novosHistorico.length;

    // Cliente × fábrica que ele já compra: base da carteira e do funil de expansão.
    const pares = [...vinculos].map((v) => v.split("|")).filter(([, f]) => f && f !== "undefined");
    const r = await tx.clienteFabrica.createMany({
      data: pares.map(([clienteId, fabricaIdV]) => ({ clienteId, fabricaId: fabricaIdV })),
      skipDuplicates: true,
    });
    resumo.vinculosClienteFabrica = r.count;
  };

  const DESFAZER = "simulação: desfazendo";
  try {
    await prisma.$transaction(
      async (tx) => {
        await executar(tx);
        if (!opcoes.aplicar) throw new Error(DESFAZER);
      },
      { timeout: 240_000, maxWait: 20_000 },
    );
  } catch (erro) {
    if (!(erro instanceof Error && erro.message === DESFAZER)) throw erro;
  }
  return resumo;
}
