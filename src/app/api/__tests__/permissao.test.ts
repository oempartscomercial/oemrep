import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { GET as getFabricas } from "../fabricas/route";
import { GET as getClientes } from "../clientes/route";

afterEach(() => obterUsuarioLogadoMock.mockReset());

describe("APIs de apoio aos formulários — sessão e escopo por fábrica (ADR-009)", () => {
  it("respondem 401 sem sessão e só mostram as fábricas permitidas", async () => {
    const fabricaA = await prisma.fabrica.create({ data: { nome: "Fábrica API A", cnpj: "82000000000101" } });
    const fabricaB = await prisma.fabrica.create({ data: { nome: "Fábrica API B", cnpj: "82000000000202" } });
    const cliente = await prisma.cliente.create({
      data: { nomeFantasia: "Cliente API", fabricas: { create: [{ fabricaId: fabricaB.id }] } },
    });
    try {
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect((await getFabricas()).status).toBe(401);
      expect((await getClientes(new NextRequest(`http://x/api/clientes?fabricaId=${fabricaB.id}`))).status).toBe(401);

      obterUsuarioLogadoMock.mockResolvedValue({ id: "u", nome: "Op", perfil: "OPERADOR", fabricasIds: [fabricaA.id] });
      const fabricas: { id: string }[] = await (await getFabricas()).json();
      expect(fabricas.map((f) => f.id)).toEqual([fabricaA.id]);

      const negado = await getClientes(new NextRequest(`http://x/api/clientes?fabricaId=${fabricaB.id}`));
      expect(negado.status).toBe(403);

      obterUsuarioLogadoMock.mockResolvedValue({ id: "u", nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
      const clientes: { id: string }[] = await (
        await getClientes(new NextRequest(`http://x/api/clientes?fabricaId=${fabricaB.id}`))
      ).json();
      expect(clientes.map((c) => c.id)).toEqual([cliente.id]);
    } finally {
      await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
    }
  });
});
