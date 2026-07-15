import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { criarPedidoManual } from "../actions";

function montarFormData(fabricaId: string, clienteId: string): FormData {
  const formData = new FormData();
  formData.set("numero", "PED-AUTHZ-1");
  formData.set("fabricaId", fabricaId);
  formData.set("clienteId", clienteId);
  formData.append("referencia", "REF-1");
  formData.append("descricao", "Peça");
  formData.append("quantidade", "1");
  formData.append("valorUnitario", "10");
  return formData;
}

describe("criarPedidoManual — autorização por fábrica (ADR-009)", () => {
  it("recusa criar pedido em fábrica que o usuário não tem permissão", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Sem Permissão", cnpj: "80000000000635" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000000716", nomeFantasia: "Cliente Sem Permissão" },
    });
    obterUsuarioLogadoMock.mockResolvedValue({
      id: "u1",
      nome: "Op",
      perfil: "OPERADOR",
      fabricasIds: ["outra-fabrica-qualquer"],
    });

    const resultado = await criarPedidoManual(montarFormData(fabrica.id, cliente.id));

    expect(resultado.erros).toEqual(["Você não tem permissão para criar pedidos nesta fábrica."]);
    const pedidosCriados = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id } });
    expect(pedidosCriados).toHaveLength(0);

    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);

  it("permite criar pedido quando o usuário tem permissão na fábrica", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Com Permissão", cnpj: "80000000000805" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000000988", nomeFantasia: "Cliente Com Permissão" },
    });
    const usuario = await prisma.usuario.create({
      data: { nome: "Op", email: "op-authz-2@example.com", perfil: "OPERADOR" },
    });
    obterUsuarioLogadoMock.mockResolvedValue({
      id: usuario.id,
      nome: "Op",
      perfil: "OPERADOR",
      fabricasIds: [fabrica.id],
    });

    const resultado = await criarPedidoManual(montarFormData(fabrica.id, cliente.id));

    expect(resultado.erros).toEqual([]);
    const pedidosCriados = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id } });
    expect(pedidosCriados).toHaveLength(1);

    await prisma.eventoAuditoria.deleteMany({ where: { entidadeId: pedidosCriados[0].id } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedidosCriados[0].id } });
    await prisma.pedido.delete({ where: { id: pedidosCriados[0].id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
