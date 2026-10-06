// Seed local com os dados reais da pasta operacional do Rômulo (rep/dados).
// Os dados NÃO ficam no repositório: são lidos na hora, de REP_DADOS_DIR
// (padrão: ~/Documents/Dev/Outros/rep/dados, vizinha deste projeto).
// Só roda contra banco local e vazio — nunca contra o Supabase.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  lerCsv,
  mapearConta,
  mapearContato,
  mapearInteracao,
  mapearPedidoHistorico,
  nomeFabrica,
} from "../src/domain/crm/importacao-rep";

const prisma = new PrismaClient();

const DIR = process.env.REP_DADOS_DIR ?? path.resolve(__dirname, "../../Outros/rep/dados");

// Usuários de desenvolvimento. SKIP_AUTH_EMAIL do .env.local aponta para o Rômulo.
const ROMULO = { nome: "Rômulo", email: "romulo@oem.local", perfil: "ADMIN" as const };
const OPERADOR = { nome: "Operador (teste)", email: "operador@oem.local", perfil: "OPERADOR" as const };
const FABRICAS_DO_OPERADOR = ["AUTOFLEX", "BOWDEN"];

function ler(arquivo: string) {
  return lerCsv(readFileSync(path.join(DIR, arquivo), "utf8"));
}

// CNPJ fictício, só para o ambiente local: a planilha não traz o CNPJ das fábricas.
function cnpjFicticioFabrica(indice: number) {
  return `99${String(indice + 1).padStart(12, "0")}`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error("seed-rep só roda contra banco local (DATABASE_URL em localhost).");
  }
  if ((await prisma.cliente.count()) > 0) {
    throw new Error("O banco já tem empresas. Recrie o banco local antes (npm run db:local:recriar).");
  }

  // Mapeia tudo antes de gravar: qualquer valor desconhecido para a importação inteira.
  const contas = ler("contas.csv").map(mapearConta);
  const contatos = ler("contatos.csv").map(mapearContato);
  const interacoes = ler("interacoes.csv").map(mapearInteracao);
  const pedidos = ler("pedidos.csv").map(mapearPedidoHistorico);

  const resumo = await prisma.$transaction(
    async (tx) => {
      const fabricantes = [...new Set(pedidos.map((p) => p.fabricante))].sort();
      const fabricaId = new Map<string, string>();
      for (const [i, fabricante] of fabricantes.entries()) {
        const f = await tx.fabrica.create({ data: { nome: nomeFabrica(fabricante), cnpj: cnpjFicticioFabrica(i) } });
        fabricaId.set(fabricante, f.id);
      }

      const romulo = await tx.usuario.create({ data: ROMULO });
      await tx.usuario.create({
        data: {
          ...OPERADOR,
          fabricas: {
            create: FABRICAS_DO_OPERADOR.filter((f) => fabricaId.has(f)).map((f) => ({ fabricaId: fabricaId.get(f)! })),
          },
        },
      });
      const usuarioPorNome = new Map([[ROMULO.nome, romulo.id]]);

      const clienteId = new Map<string, string>();
      let semProximoPasso = 0;
      for (const conta of contas) {
        const { chave, proximoPasso, ...dados } = conta;
        const c = await tx.cliente.create({ data: { ...dados, origem: "pasta rep" } });
        clienteId.set(chave, c.id);
        if (proximoPasso) {
          const responsavelId = usuarioPorNome.get(proximoPasso.dono);
          if (!responsavelId) throw new Error(`conta ${chave}: responsável desconhecido "${proximoPasso.dono}"`);
          await tx.proximoPasso.create({
            data: { clienteId: c.id, acao: proximoPasso.acao, prazo: proximoPasso.prazo, responsavelId },
          });
        } else if (conta.situacao !== "CLIENTE") {
          semProximoPasso++;
        }
      }

      const idDaConta = (chave: string, onde: string) => {
        const id = clienteId.get(chave);
        if (!id) throw new Error(`${onde}: conta ${chave} não existe em contas.csv`);
        return id;
      };

      for (const { chaveConta, ...dados } of contatos) {
        await tx.contato.create({ data: { ...dados, clienteId: idDaConta(chaveConta, "contato") } });
      }
      for (const { chaveConta, ...dados } of interacoes) {
        await tx.interacao.create({
          data: { ...dados, origem: "IMPORTACAO", clienteId: idDaConta(chaveConta, "interação") },
        });
      }

      const vinculos = new Set<string>();
      for (const { chaveConta, fabricante, ...dados } of pedidos) {
        const id = idDaConta(chaveConta, `pedido da linha ${dados.linhaPlanilha}`);
        await tx.pedidoHistorico.create({ data: { ...dados, clienteId: id, fabricaId: fabricaId.get(fabricante)! } });
        if (dados.tipo === "PEDIDO" && !dados.suspeitaDuplicidade) vinculos.add(`${id}|${fabricaId.get(fabricante)}`);
      }
      // Cliente × fábrica que ele já compra: base do funil de expansão da carteira.
      await tx.clienteFabrica.createMany({
        data: [...vinculos].map((v) => {
          const [clienteIdV, fabricaIdV] = v.split("|");
          return { clienteId: clienteIdV, fabricaId: fabricaIdV };
        }),
      });

      return {
        fabricas: fabricantes.length,
        empresas: contas.length,
        contatos: contatos.length,
        interacoes: interacoes.length,
        pedidosHistorico: pedidos.length,
        clienteFabrica: vinculos.size,
        prospeccaoSemProximoPasso: semProximoPasso,
      };
    },
    { timeout: 60_000 },
  );

  console.log(`Seed da pasta rep (${DIR}):`, resumo);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
