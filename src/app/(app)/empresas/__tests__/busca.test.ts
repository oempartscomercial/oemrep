import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));

import { buscarGlobalAction } from "../../busca-actions";
import { lerTipoEmpresa, listarEmpresas } from "../queries";

afterEach(() => obterUsuarioLogadoMock.mockReset());

describe("busca global (⌘K)", () => {
  it("OPERADOR só acha pedidos das suas fábricas; ANALISTA acha empresas e pessoas", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Busca", cnpj: "84000000000101" } });
    const outra = await prisma.fabrica.create({ data: { nome: "Fábrica Busca B", cnpj: "84000000000202" } });
    const empresa = await prisma.cliente.create({
      data: { nomeFantasia: "Zebrinha Autopeças Busca", situacao: "CANDIDATA", contatos: { create: [{ nome: "Zuleica Busca", canal: "EMAIL", valor: "z@x.com", fonte: "teste" }] } },
    });
    const pedido = await prisma.pedido.create({ data: { numero: "ZEB-9001", origem: "MANUAL", fabricaId: fabrica.id, clienteId: empresa.id } });
    const pedidoB = await prisma.pedido.create({ data: { numero: "ZEB-9002", origem: "MANUAL", fabricaId: outra.id, clienteId: empresa.id } });
    try {
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect(await buscarGlobalAction("zeb")).toEqual({ empresas: [], contatos: [], pedidos: [] });

      obterUsuarioLogadoMock.mockResolvedValue({ id: "u", nome: "Op", perfil: "OPERADOR", fabricasIds: [fabrica.id] });
      const operador = await buscarGlobalAction("zeb");
      expect(operador.empresas).toEqual([]);
      expect(operador.contatos).toEqual([]);
      expect(operador.pedidos.map((p) => p.numero)).toEqual(["ZEB-9001"]);

      obterUsuarioLogadoMock.mockResolvedValue({ id: "u", nome: "An", perfil: "ANALISTA", fabricasIds: [fabrica.id] });
      const analista = await buscarGlobalAction("zuleica");
      expect(analista.contatos.map((c) => c.nome)).toEqual(["Zuleica Busca"]);
      expect(analista.contatos[0].empresaId).toBe(empresa.id);
      expect((await buscarGlobalAction("zebrinha")).empresas.map((e) => e.id)).toEqual([empresa.id]);
      expect((await buscarGlobalAction("z")).empresas).toEqual([]); // menos de 2 letras
    } finally {
      await prisma.pedido.deleteMany({ where: { id: { in: [pedido.id, pedidoB.id] } } });
      await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
      await prisma.cliente.delete({ where: { id: empresa.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabrica.id, outra.id] } } });
    }
  }, 15000);
});

describe("listarEmpresas", () => {
  it("separa clientes de prospecção e busca por nome, ignorando maiúsculas", async () => {
    const prospect = await prisma.cliente.create({ data: { nomeFantasia: "Quimera Prospect Lista", situacao: "CANDIDATA" } });
    const cliente = await prisma.cliente.create({ data: { nomeFantasia: "Quimera Cliente Lista", situacao: "CLIENTE" } });
    try {
      const nomes = async (tipo: "todas" | "clientes" | "prospeccao") =>
        (await listarEmpresas(tipo, "QUIMERA", 1)).empresas.map((e) => e.nomeFantasia).sort();
      expect(await nomes("todas")).toEqual(["Quimera Cliente Lista", "Quimera Prospect Lista"]);
      expect(await nomes("clientes")).toEqual(["Quimera Cliente Lista"]);
      expect(await nomes("prospeccao")).toEqual(["Quimera Prospect Lista"]);
      expect(lerTipoEmpresa("qualquer")).toBe("todas");
    } finally {
      await prisma.cliente.deleteMany({ where: { id: { in: [prospect.id, cliente.id] } } });
    }
  }, 15000);
});
