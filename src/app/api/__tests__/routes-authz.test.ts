import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { GET as getFabricas } from "../fabricas/route";
import { GET as getClientes } from "../clientes/route";

const pedidoClientes = (fabricaId: string) =>
  new NextRequest(`http://localhost/api/clientes?fabricaId=${fabricaId}`);

beforeEach(() => {
  obterUsuarioLogadoMock.mockReset();
});

describe("GET /api/fabricas — autorização (ADR-009)", () => {
  it("recusa visitante sem sessão com 401", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(null);

    const resposta = await getFabricas();

    expect(resposta.status).toBe(401);
  });

  it("devolve apenas as fábricas permitidas ao operador", async () => {
    const permitida = await prisma.fabrica.create({
      data: { nome: "Fábrica Authz Permitida", cnpj: "81000000000105" },
    });
    const proibida = await prisma.fabrica.create({
      data: { nome: "Fábrica Authz Proibida", cnpj: "81000000000202" },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({
        id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: [permitida.id],
      });

      const resposta = await getFabricas();
      const corpo = (await resposta.json()) as { id: string }[];
      const ids = corpo.map((f) => f.id);

      expect(ids).toContain(permitida.id);
      expect(ids).not.toContain(proibida.id);
    } finally {
      await prisma.fabrica.deleteMany({ where: { id: { in: [permitida.id, proibida.id] } } });
    }
  }, 15000);

  it("devolve todas as fábricas ao ADMIN", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Authz Admin", cnpj: "81000000000309" },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({
        id: "u1", nome: "Chefe", perfil: "ADMIN", fabricasIds: [],
      });

      const resposta = await getFabricas();
      const corpo = (await resposta.json()) as { id: string }[];

      expect(corpo.map((f) => f.id)).toContain(fabrica.id);
    } finally {
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});

describe("GET /api/clientes — autorização (ADR-009)", () => {
  it("recusa visitante sem sessão com 401", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(null);

    const resposta = await getClientes(pedidoClientes("qualquer"));

    expect(resposta.status).toBe(401);
  });

  it("não vaza os clientes de uma fábrica sem permissão", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Authz Clientes", cnpj: "81000000000406" },
    });
    const cliente = await prisma.cliente.create({
      data: {
        cnpj: "81000000000502",
        nomeFantasia: "Cliente Authz Sigiloso",
        fabricas: { create: [{ fabricaId: fabrica.id }] },
      },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({
        id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra-fabrica"],
      });

      const resposta = await getClientes(pedidoClientes(fabrica.id));

      expect(resposta.status).toBe(403);
      expect(await resposta.json()).not.toContainEqual(
        expect.objectContaining({ id: cliente.id }),
      );
    } finally {
      await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
