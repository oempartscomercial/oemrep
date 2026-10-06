import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarItens, ITENS_POR_PAGINA } from "../queries";

describe("buscarItens (RF06)", () => {
  it("filtra por fábrica permitida, status, referência, cliente e mês, com paginação", async () => {
    const fabA = await prisma.fabrica.create({ data: { nome: "Fab Itens A", cnpj: "85000000000101" } });
    const fabB = await prisma.fabrica.create({ data: { nome: "Fab Itens B", cnpj: "85000000000202" } });
    const cliente = await prisma.cliente.create({ data: { nomeFantasia: "Cliente Itens" } });
    const pedidoJul = await prisma.pedido.create({
      data: {
        numero: "IT-1", origem: "MANUAL", fabricaId: fabA.id, clienteId: cliente.id, criadoEm: new Date("2026-07-10T12:00:00Z"),
        itens: {
          create: [
            { referencia: "BW-100", descricao: "Cubo", quantidadePedida: 10, quantidadeFaturada: 4, valorUnitario: 5 },
            { referencia: "BW-200", descricao: "Eixo", quantidadePedida: 1, quantidadeFaturada: 1, valorUnitario: 9, status: "OK" },
          ],
        },
      },
    });
    const pedidoB = await prisma.pedido.create({
      data: {
        numero: "IT-2", origem: "MANUAL", fabricaId: fabB.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "BW-100", descricao: "Cubo", quantidadePedida: 3, valorUnitario: 5 }] },
      },
    });
    const operadorA = { id: "u", nome: "Op", perfil: "OPERADOR" as const, fabricasIds: [fabA.id] };
    try {
      const pendentesA = await buscarItens(operadorA, { status: "PENDENTE", pagina: 1 });
      expect(pendentesA.itens.map((i) => i.referencia)).toEqual(["BW-100"]);
      expect(pendentesA.itens[0].quantidadePendente).toBe(6);
      expect(pendentesA.total).toBe(1);

      const todosA = await buscarItens(operadorA, { status: "TODOS", referencia: "bw-2", pagina: 1 });
      expect(todosA.itens.map((i) => i.referencia)).toEqual(["BW-200"]);

      const foraDoMes = await buscarItens(operadorA, { status: "TODOS", mes: "2026-08", pagina: 1 });
      expect(foraDoMes.total).toBe(0);
      const noMes = await buscarItens(operadorA, { status: "TODOS", mes: "2026-07", clienteId: cliente.id, pagina: 1 });
      expect(noMes.total).toBe(2);

      const tentaOutraFabrica = await buscarItens(operadorA, { status: "TODOS", fabricaId: fabB.id, pagina: 1 });
      expect(tentaOutraFabrica.total).toBe(0);

      const admin = { id: "a", nome: "Adm", perfil: "ADMIN" as const, fabricasIds: [] };
      const paginaDois = await buscarItens(admin, { status: "TODOS", clienteId: cliente.id, pagina: 2 });
      expect(paginaDois.total).toBe(3);
      expect(paginaDois.itens).toHaveLength(Math.max(0, 3 - ITENS_POR_PAGINA));
    } finally {
      await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: [pedidoJul.id, pedidoB.id] } } });
      await prisma.pedido.deleteMany({ where: { id: { in: [pedidoJul.id, pedidoB.id] } } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabA.id, fabB.id] } } });
    }
  });
});
