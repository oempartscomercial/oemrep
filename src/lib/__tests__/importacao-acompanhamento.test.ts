import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { importarAcompanhamento } from "../importacao-acompanhamento";
import type { LinhaAcompanhamento } from "@/domain/importacao/acompanhamento";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const linha = (l: Partial<LinhaAcompanhamento>): LinhaAcompanhamento => ({
  cnpj: "07965809990001",
  fantasia: "FILIAL-99",
  dataPedido: d("2026-08-01"),
  numero: "IMP-ACOMP-1",
  referencia: "R1",
  quantidadePedida: 10,
  quantidadePendente: 0,
  valorUnitario: 10,
  situacao: "OK",
  ...l,
});

describe("importarAcompanhamento", () => {
  it("cria clientes e pedidos em aberto e não duplica ao rodar de novo", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica ImportAcomp", cnpj: "84000000000001" } });
    const usuario = await prisma.usuario.create({ data: { nome: "Imp", email: "imp-acomp@teste.local", perfil: "ADMIN" } });
    const linhas = [
      linha({ referencia: "R1", situacao: "OK" }),
      linha({ referencia: "R2", situacao: "PENDENTE", quantidadePendente: 4 }),
      linha({ numero: null, cnpj: "84000000000099", fantasia: "LOJA X - PA", situacao: "PENDENTE", quantidadePendente: 10 }),
      linha({ numero: "IMP-ACOMP-FECHADO", referencia: "R9", situacao: "OK" }),
    ];

    try {
      const simulacao = await importarAcompanhamento(prisma, { fabricaId: fabrica.id, usuarioId: usuario.id, linhas, aplicar: false });
      expect(simulacao).toMatchObject({ clientesNovos: 2, pedidosNovos: 2, itens: 3, saldo: 140 });
      expect(await prisma.pedido.count({ where: { fabricaId: fabrica.id } })).toBe(0);

      const primeira = await importarAcompanhamento(prisma, { fabricaId: fabrica.id, usuarioId: usuario.id, linhas, aplicar: true });
      expect(primeira).toMatchObject({ clientesNovos: 2, pedidosNovos: 2, pedidosJaImportados: 0 });

      const pedidos = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id }, include: { itens: true, cliente: true } });
      const numerado = pedidos.find((p) => p.numero === "IMP-ACOMP-1")!;
      expect(numerado).toMatchObject({ estado: "PARCIAL", origem: "EXCEL" });
      expect(numerado.cliente).toMatchObject({ nomeFantasia: "PADRE CÍCERO FILIAL-99", situacao: "CLIENTE" });
      expect(numerado.itens.map((i) => [i.referencia, i.quantidadeFaturada, i.status]).sort()).toEqual([
        ["R1", 10, "OK"],
        ["R2", 6, "PENDENTE"],
      ]);
      const semNumero = pedidos.find((p) => p.semNumero)!;
      expect(semNumero).toMatchObject({ estado: "SEM_NFE", numero: null });
      expect(semNumero.cliente.uf).toBe("PA");
      expect(await prisma.clienteFabrica.count({ where: { fabricaId: fabrica.id } })).toBe(2);

      const segunda = await importarAcompanhamento(prisma, { fabricaId: fabrica.id, usuarioId: usuario.id, linhas, aplicar: true });
      expect(segunda).toMatchObject({ clientesNovos: 0, clientesExistentes: 2, pedidosNovos: 0, pedidosJaImportados: 2 });
      expect(await prisma.pedido.count({ where: { fabricaId: fabrica.id } })).toBe(2);
    } finally {
      const pedidos = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id }, select: { id: true, clienteId: true } });
      const clientes = [...new Set(pedidos.map((p) => p.clienteId))];
      await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: pedidos.map((p) => p.id) } } });
      await prisma.pedido.deleteMany({ where: { fabricaId: fabrica.id } });
      await prisma.clienteFabrica.deleteMany({ where: { fabricaId: fabrica.id } });
      await prisma.interacao.deleteMany({ where: { clienteId: { in: clientes } } });
      await prisma.cliente.deleteMany({ where: { id: { in: clientes } } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 30000);
});
