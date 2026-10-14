import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { carregarBaseRep, type EntradaCargaRep } from "../carga-base-rep";

const sufixo = "CARGAREP";
const conta = (c: Record<string, string>) => ({
  conta_id: "", nome: "", tipo: "", situacao: "", uf: "", cidade: "", cnpj: "", site: "", rotulos_planilha: "", grupo: "",
  dono: "", proxima_acao: "", prazo: "", observacoes: "", atualizado_em: "", ...c,
});
const contato = (c: Record<string, string>) => ({
  conta_id: "", nome: "", funcao: "", canal: "", valor: "", serve_para: "", status: "", fonte: "", verificado_em: "", nao_contatar: "", observacoes: "", ...c,
});

function entrada(): EntradaCargaRep {
  return {
    clientesPlanilha: [{ cnpj: "85000000000001", nomes: [`ARAUTHO ${sufixo} - TO`], fabricas: [`Autoflex ${sufixo}`] }],
    contas: [
      conta({ conta_id: "CLI-T1", nome: `ARAUTHO ${sufixo}`, situacao: "cliente", uf: "TO", rotulos_planilha: `ARAUTHO ${sufixo} - TO` }),
      conta({ conta_id: "CLI-T2", nome: `SEM PAR ${sufixo}`, situacao: "cliente", rotulos_planilha: `SEM PAR ${sufixo}` }),
      conta({ conta_id: "RUD-T1", nome: `Trator ${sufixo}`, situacao: "candidata", uf: "MA", dono: "Ninguém Assim", proxima_acao: "Avaliar" }),
    ],
    contatos: [
      contato({ conta_id: "RUD-T1", canal: "whatsapp", valor: "(99) 98888-7777", status: "publicado no site, não testado", fonte: "https://trator.example/contato" }),
      contato({ conta_id: "RUD-T1", canal: "pessoa", nome: "Fulano Sócio", status: "pessoa identificada (confirmado)", fonte: "Quadro de sócios da Receita" }),
      contato({ conta_id: "RUD-T1", canal: "linkedin", valor: "https://linkedin.com/in/x", status: "não confirmado: não usar", fonte: "https://linkedin.com/in/x" }),
    ],
    interacoes: [{ conta_id: "RUD-T1", data: "2026-10-03", canal: "pesquisa", com_quem: "", resumo: `Pesquisa ${sufixo}`, resultado: "" }],
    pedidos: [
      { conta_id: "CLI-T1", linha_planilha: "990001", data: "2026-08-01", fabricante: `AUTOFLEX ${sufixo}`, valor_sem_imposto: "1000.50", tipo: "pedido", cliente_planilha: `ARAUTHO ${sufixo} - TO`, alerta: "" },
      { conta_id: "CLI-T2", linha_planilha: "990002", data: "2026-09-10", fabricante: `CORVEN ${sufixo}`, valor_sem_imposto: "200", tipo: "pedido", cliente_planilha: `SEM PAR ${sufixo}`, alerta: "" },
    ],
  };
}

describe("carregarBaseRep", () => {
  it("simula sem gravar, carrega casando pelo CNPJ e não duplica ao rodar de novo", async () => {
    const usuario = await prisma.usuario.create({ data: { nome: `Resp ${sufixo}`, email: "carga-rep@teste.local", perfil: "ADMIN" } });
    const autoflex = await prisma.fabrica.create({ data: { nome: `Autoflex ${sufixo}`, cnpj: "85000000000099" } });
    try {
      const simulacao = await carregarBaseRep(prisma, entrada(), { aplicar: false, responsavelPadraoId: usuario.id, prazoPadrao: "2026-10-14" });
      expect(simulacao).toMatchObject({ clientesPlanilhaNovos: 1, contasCasadasPorCnpj: 1, contasNovas: 2, pedidosHistoricoNovos: 2 });
      expect(await prisma.cliente.count({ where: { nomeFantasia: { contains: sufixo } } })).toBe(0);

      const r = await carregarBaseRep(prisma, entrada(), { aplicar: true, responsavelPadraoId: usuario.id, prazoPadrao: "2026-10-14" });
      expect(r.fabricasCriadas).toEqual([`Corven ${sufixo.toLowerCase()}`]);
      expect(r).toMatchObject({ contatosNovos: 3, interacoesNovas: 1, proximosPassosNovos: 1, contasSemCnpj: [`SEM PAR ${sufixo}`] });

      const arautho = await prisma.cliente.findUniqueOrThrow({ where: { cnpj: "85000000000001" }, include: { fabricas: true, pedidosHistorico: true } });
      expect(arautho.nomeFantasia).toBe(`ARAUTHO ${sufixo} - TO`);
      expect(arautho.fabricas.map((f) => f.fabricaId)).toEqual([autoflex.id]);
      expect(arautho.pedidosHistorico).toHaveLength(1);

      const trator = await prisma.cliente.findFirstOrThrow({ where: { nomeFantasia: `Trator ${sufixo}` }, include: { contatos: true, proximosPassos: true } });
      expect(trator.situacao).toBe("CANDIDATA");
      expect(trator.proximosPassos[0].responsavelId).toBe(usuario.id);
      expect(trator.proximosPassos[0].prazo.toISOString().slice(0, 10)).toBe("2026-10-14");
      const origem = Object.fromEntries(trator.contatos.map((c) => [c.canal, c.origemContato]));
      expect(origem).toEqual({ WHATSAPP: "PUBLICADO_PELA_EMPRESA", OUTRO: null, LINKEDIN: null });

      const corven = await prisma.fabrica.findFirstOrThrow({ where: { nome: `Corven ${sufixo.toLowerCase()}` } });
      expect(corven.cnpj).toBeNull();

      const de_novo = await carregarBaseRep(prisma, entrada(), { aplicar: true, responsavelPadraoId: usuario.id, prazoPadrao: "2026-10-14" });
      expect(de_novo).toMatchObject({ clientesPlanilhaNovos: 0, contasNovas: 0, contatosNovos: 0, interacoesNovas: 0, proximosPassosNovos: 0, pedidosHistoricoNovos: 0, vinculosClienteFabrica: 0, fabricasCriadas: [] });
    } finally {
      const clientes = (await prisma.cliente.findMany({ where: { nomeFantasia: { contains: sufixo } }, select: { id: true } })).map((c) => c.id);
      await prisma.pedidoHistorico.deleteMany({ where: { clienteId: { in: clientes } } });
      await prisma.clienteFabrica.deleteMany({ where: { clienteId: { in: clientes } } });
      await prisma.contato.deleteMany({ where: { clienteId: { in: clientes } } });
      await prisma.interacao.deleteMany({ where: { clienteId: { in: clientes } } });
      await prisma.proximoPasso.deleteMany({ where: { clienteId: { in: clientes } } });
      await prisma.cliente.deleteMany({ where: { id: { in: clientes } } });
      await prisma.fabrica.deleteMany({ where: { nome: { contains: sufixo, mode: "insensitive" } } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
    }
  }, 60000);
});
