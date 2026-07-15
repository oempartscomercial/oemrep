import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarPedidosPermitidos, buscarPedidoComPermissao } from "../queries";

describe("buscarPedidosPermitidos / buscarPedidoComPermissao", () => {
  it("filtra pedidos pelas fábricas do usuário e bloqueia detalhe de fábrica não permitida", async () => {
    const fabricaA = await prisma.fabrica.create({
      data: { nome: "Fábrica A Pedidos", cnpj: "80000000000392" },
    });
    const fabricaB = await prisma.fabrica.create({
      data: { nome: "Fábrica B Pedidos", cnpj: "80000000000473" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000000554", nomeFantasia: "Cliente Pedidos Queries" },
    });
    const pedidoA = await prisma.pedido.create({
      data: { numero: "PED-QA-1", origem: "MANUAL", fabricaId: fabricaA.id, clienteId: cliente.id },
    });
    const pedidoB = await prisma.pedido.create({
      data: { numero: "PED-QB-1", origem: "MANUAL", fabricaId: fabricaB.id, clienteId: cliente.id },
    });

    const operadorA = { id: "u1", nome: "Op A", perfil: "OPERADOR" as const, fabricasIds: [fabricaA.id] };
    const admin = { id: "u2", nome: "Admin", perfil: "ADMIN" as const, fabricasIds: [] };

    const listaOperador = await buscarPedidosPermitidos(operadorA);
    expect(listaOperador.map((p) => p.id)).toContain(pedidoA.id);
    expect(listaOperador.map((p) => p.id)).not.toContain(pedidoB.id);

    const listaAdmin = await buscarPedidosPermitidos(admin);
    expect(listaAdmin.map((p) => p.id)).toEqual(
      expect.arrayContaining([pedidoA.id, pedidoB.id]),
    );

    const detalhePermitido = await buscarPedidoComPermissao(pedidoA.id, operadorA);
    expect(detalhePermitido?.id).toBe(pedidoA.id);

    const detalheNegado = await buscarPedidoComPermissao(pedidoB.id, operadorA);
    expect(detalheNegado).toBeNull();

    await prisma.pedido.deleteMany({ where: { id: { in: [pedidoA.id, pedidoB.id] } } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
  }, 15000);
});
