import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// O `after` do Next só existe dentro de uma requisição; no teste ele vira no-op para não disparar a consulta de rastreio.
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { analisarXmlNFe, confirmarBaixaNFe } from "../actions";

const CNPJ_FABRICA = "74100001000144";
const CNPJ_CLIENTE = "74100002000199";
const CNPJ_TRANSPORTADORA = "74100003000133";

// Chave de 44 dígitos; o número da nota muda a chave, então cada NFe do teste tem a sua.
const chaveDe = (n: number) => "41" + CNPJ_FABRICA + "55001" + String(n).padStart(9, "0") + "12345678901234";

type ItemXmlTeste = { referencia: string; quantidade: number; valorUnitario: number; xPed?: string };

// XML de NFe com o que estes testes precisam: <transp> e <xPed> por item, que o helper compartilhado não monta.
function xmlNFe(n: {
  chave: string;
  numero: string;
  destinatario: string;
  itens: ItemXmlTeste[];
  transporte?: string;
}): string {
  const total = n.itens.reduce((soma, i) => soma + i.quantidade * i.valorUnitario, 0).toFixed(2);
  const dets = n.itens
    .map(
      (i, idx) => `
      <det nItem="${idx + 1}">
        <prod>
          <cProd>${i.referencia}</cProd>
          <xProd>Peça ${i.referencia}</xProd>
          <qCom>${i.quantidade.toFixed(4)}</qCom>
          <vUnCom>${i.valorUnitario.toFixed(2)}</vUnCom>${i.xPed ? `\n          <xPed>${i.xPed}</xPed>` : ""}
        </prod>
      </det>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${n.chave}" versao="4.00">
      <ide>
        <nNF>${n.numero}</nNF>
        <dhEmi>2026-07-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit><CNPJ>${CNPJ_FABRICA}</CNPJ></emit>
      <dest><CNPJ>${n.destinatario}</CNPJ></dest>${dets}
      <total>
        <ICMSTot>
          <vProd>${total}</vProd>
          <vNF>${total}</vNF>
        </ICMSTot>
      </total>${n.transporte ?? ""}
    </infNFe>
  </NFe>
</nfeProc>`;
}

const TRANSPORTE = `<transp><transporta><CNPJ>${CNPJ_TRANSPORTADORA}</CNPJ><xNome>Transportadora Teste Ltda</xNome></transporta><vol><qVol>2</qVol><pesoB>14.5</pesoB></vol></transp>`;

function arquivo(xml: string) {
  const formData = new FormData();
  formData.append("arquivo", new File([xml], "nota.xml", { type: "text/xml" }));
  return formData;
}

async function cenario() {
  const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Transp Teste", cnpj: CNPJ_FABRICA } });
  const cliente = await prisma.cliente.create({ data: { cnpj: CNPJ_CLIENTE, nomeFantasia: "Cliente Transp Teste" } });
  const usuario = await prisma.usuario.create({ data: { nome: "Adm Transp", email: "transp-rapido@teste.dev", perfil: "ADMIN" } });
  return { fabrica, cliente, usuario };
}

async function limpar(c: Awaited<ReturnType<typeof cenario>>) {
  const notas = await prisma.notaFiscal.findMany({ where: { emitenteCnpj: CNPJ_FABRICA }, select: { id: true } });
  const notaIds = notas.map((n) => n.id);
  const pedidos = await prisma.pedido.findMany({ where: { fabricaId: c.fabrica.id }, select: { id: true } });
  await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: { in: notaIds } } });
  await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: { in: notaIds } } });
  await prisma.notaFiscal.deleteMany({ where: { id: { in: notaIds } } });
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: c.usuario.id } });
  await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: pedidos.map((p) => p.id) } } });
  await prisma.pedido.deleteMany({ where: { fabricaId: c.fabrica.id } });
  await prisma.transportadora.deleteMany({ where: { cnpj: CNPJ_TRANSPORTADORA } });
  await prisma.cliente.deleteMany({ where: { id: c.cliente.id } });
  await prisma.usuario.deleteMany({ where: { id: c.usuario.id } });
  await prisma.fabrica.deleteMany({ where: { id: c.fabrica.id } });
}

describe("confirmarBaixaNFe — transportadora do <transp>", () => {
  it("cria a transportadora como NAO_MAPEADA com volumes e peso da nota, e reaproveita a mesma na segunda NFe", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
      await prisma.pedido.create({
        data: {
          numero: "PED-TR-1",
          origem: "MANUAL",
          fabricaId: c.fabrica.id,
          clienteId: c.cliente.id,
          itens: { create: [{ referencia: "REF-T1", descricao: "Peça", quantidadePedida: 20, valorUnitario: 25 }] },
        },
      });

      const primeira = await confirmarBaixaNFe({
        xml: xmlNFe({ chave: chaveDe(1), numero: "501", destinatario: CNPJ_CLIENTE, itens: [{ referencia: "REF-T1", quantidade: 2, valorUnitario: 25 }], transporte: TRANSPORTE }),
        clienteId: null,
      });
      expect(primeira.erros).toEqual([]);

      const transportadora = await prisma.transportadora.findUniqueOrThrow({ where: { cnpj: CNPJ_TRANSPORTADORA } });
      expect(transportadora).toMatchObject({ nome: "Transportadora Teste Ltda", metodo: "NAO_MAPEADA", criadaAutomaticamente: true });
      const nota1 = await prisma.notaFiscal.findUniqueOrThrow({ where: { id: primeira.notaFiscalId! } });
      expect(nota1.transportadoraId).toBe(transportadora.id);
      expect(nota1.volumes).toBe(2);
      expect(Number(nota1.pesoBruto)).toBe(14.5);

      const segunda = await confirmarBaixaNFe({
        xml: xmlNFe({ chave: chaveDe(2), numero: "502", destinatario: CNPJ_CLIENTE, itens: [{ referencia: "REF-T1", quantidade: 3, valorUnitario: 25 }], transporte: TRANSPORTE }),
        clienteId: null,
      });
      expect(segunda.erros).toEqual([]);

      expect(await prisma.transportadora.count({ where: { cnpj: CNPJ_TRANSPORTADORA } })).toBe(1);
      const nota2 = await prisma.notaFiscal.findUniqueOrThrow({ where: { id: segunda.notaFiscalId! } });
      expect(nota2.transportadoraId).toBe(transportadora.id);
    } finally {
      await limpar(c);
    }
  }, 15000);
});

describe("confirmarBaixaNFe — completa pedido rápido (completarPedidoRapidoId)", () => {
  it("a NFe acha o pedido rápido pelo valor; a baixa cria os itens nele já faturados e o pedido vira COMPLETO", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
      // Pedido rápido: só valor (100,00), sem itens. A NFe soma 4 x 25,00 = 100,00.
      const rapido = await prisma.pedido.create({
        data: { numero: "R-300", origem: "RAPIDO", fabricaId: c.fabrica.id, clienteId: c.cliente.id, valorTotalDeclarado: 100 },
      });
      const xml = xmlNFe({ chave: chaveDe(3), numero: "503", destinatario: CNPJ_CLIENTE, itens: [{ referencia: "REF-R1", quantidade: 4, valorUnitario: 25 }] });

      const analise = await analisarXmlNFe(arquivo(xml));
      expect(analise.erro).toBeUndefined();
      expect(analise.analise?.pedidoRapido?.id).toBe(rapido.id);

      const r = await confirmarBaixaNFe({ xml, clienteId: c.cliente.id, completarPedidoRapidoId: rapido.id });
      expect(r.erros).toEqual([]);

      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: rapido.id }, include: { itens: true } });
      expect(pedido.estado).toBe("COMPLETO");
      expect(pedido.itens).toHaveLength(1);
      expect(pedido.itens[0]).toMatchObject({ referencia: "REF-R1", status: "OK", quantidadePedida: 4, quantidadeFaturada: 4 });
      expect(Number(pedido.itens[0].valorUnitario)).toBe(25);
      expect(await prisma.itemFaturado.count({ where: { itemPedidoId: pedido.itens[0].id, notaFiscalId: r.notaFiscalId } })).toBe(1);
      expect(await prisma.notaFiscalPedido.count({ where: { pedidoId: rapido.id, notaFiscalId: r.notaFiscalId } })).toBe(1);
    } finally {
      await limpar(c);
    }
  }, 15000);
});

describe("confirmarBaixaNFe — xPed escolhe o pedido quando a referência repete", () => {
  it("com a mesma referência em dois pedidos abertos, a NFe com xPed do segundo baixa no segundo", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
      const itemDup = { referencia: "REF-DUP", descricao: "Peça", quantidadePedida: 10, valorUnitario: 25 };
      const primeiro = await prisma.pedido.create({
        data: { numero: "PED-A-1", numeroCliente: "OC-AAA", origem: "MANUAL", fabricaId: c.fabrica.id, clienteId: c.cliente.id, itens: { create: [itemDup] } },
      });
      const segundo = await prisma.pedido.create({
        data: { numero: "PED-B-1", numeroCliente: "OC-BBB", origem: "MANUAL", fabricaId: c.fabrica.id, clienteId: c.cliente.id, itens: { create: [itemDup] } },
      });
      const xml = xmlNFe({
        chave: chaveDe(4),
        numero: "504",
        destinatario: CNPJ_CLIENTE,
        itens: [{ referencia: "REF-DUP", quantidade: 3, valorUnitario: 25, xPed: "OC-BBB" }],
      });

      const analise = await analisarXmlNFe(arquivo(xml));
      expect(analise.analise?.conferencia[0].pendencia?.pedidoId).toBe(segundo.id);
      expect(analise.analise?.pedidosCitados).toEqual([{ numero: "OC-BBB", pedido: "PED-B-1" }]);

      const r = await confirmarBaixaNFe({ xml, clienteId: c.cliente.id });
      expect(r.erros).toEqual([]);

      expect((await prisma.itemPedido.findFirstOrThrow({ where: { pedidoId: segundo.id } })).quantidadeFaturada).toBe(3);
      expect((await prisma.itemPedido.findFirstOrThrow({ where: { pedidoId: primeiro.id } })).quantidadeFaturada).toBe(0);
      const vinculos = await prisma.notaFiscalPedido.findMany({ where: { notaFiscalId: r.notaFiscalId } });
      expect(vinculos.map((v) => v.pedidoId)).toEqual([segundo.id]);
    } finally {
      await limpar(c);
    }
  }, 15000);
});
