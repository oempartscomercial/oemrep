import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ajustarFabricasProspeccao, ligarProspeccaoSemFabrica, whereFabricaProspeccao } from "../fabricas-prospeccao";
import { criarEmpresaProspeccao } from "../prospeccao";

const S = `fp${Date.now().toString(36)}`;
let autor: { id: string; nome: string; origem: "CLAUDE" };
let rudolph: { id: string };
let bowden: { id: string };
let inativa: { id: string };
const ids: Record<string, string> = {};

beforeAll(async () => {
  const u = await prisma.usuario.create({ data: { nome: `Rômulo ${S}`, email: `romulo-${S}@teste.local`, perfil: "ADMIN" } });
  autor = { id: u.id, nome: u.nome, origem: "CLAUDE" };
  rudolph = await prisma.fabrica.create({ data: { nome: `Rudolph ${S}` } });
  bowden = await prisma.fabrica.create({ data: { nome: `Bowden ${S}` } });
  inativa = await prisma.fabrica.create({ data: { nome: `Velha ${S}`, ativo: false } });
  ids.semFabrica = (await prisma.cliente.create({ data: { nomeFantasia: `Sem Fábrica ${S}`, situacao: "CANDIDATA", uf: "PE" } })).id;
  ids.rudolph = (await prisma.cliente.create({ data: { nomeFantasia: `Só Rudolph ${S}`, situacao: "APROVADA", uf: "CE", fabricas: { create: [{ fabricaId: rudolph.id }] } } })).id;
  ids.duas = (await prisma.cliente.create({ data: { nomeFantasia: `Duas ${S}`, situacao: "EM_CONTATO", uf: "BA", fabricas: { create: [{ fabricaId: rudolph.id }, { fabricaId: bowden.id }] } } })).id;
  ids.cliente = (await prisma.cliente.create({ data: { nomeFantasia: `Cliente ${S}`, situacao: "CLIENTE", uf: "SC", fabricas: { create: [{ fabricaId: bowden.id }] } } })).id;
});

afterAll(async () => {
  const clientes = await prisma.cliente.findMany({ where: { nomeFantasia: { contains: S } }, select: { id: true } });
  const cIds = clientes.map((c) => c.id);
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: autor.id } });
  await prisma.interacao.deleteMany({ where: { clienteId: { in: cIds } } });
  await prisma.clienteFabrica.deleteMany({ where: { clienteId: { in: cIds } } });
  await prisma.cliente.deleteMany({ where: { id: { in: cIds } } });
  await prisma.fabrica.deleteMany({ where: { id: { in: [rudolph.id, bowden.id, inativa.id] } } });
  await prisma.usuario.delete({ where: { id: autor.id } });
});

const nomesDe = async (where: object) =>
  (await prisma.cliente.findMany({ where: { AND: [{ nomeFantasia: { contains: S } }, { situacao: { not: "CLIENTE" } }, where] }, orderBy: { nomeFantasia: "asc" } })).map((c) => c.nomeFantasia);
const fabricasDa = async (id: string) =>
  (await prisma.clienteFabrica.findMany({ where: { clienteId: id }, include: { fabrica: true } })).map((v) => v.fabrica.nome).sort();

describe("filtro de fábrica do funil de prospecção", () => {
  it("uma fábrica mostra as empresas ligadas a ela (inclusive as de várias fábricas)", async () => {
    expect(await nomesDe(whereFabricaProspeccao(rudolph.id))).toEqual([`Duas ${S}`, `Só Rudolph ${S}`]);
    expect(await nomesDe(whereFabricaProspeccao(bowden.id))).toEqual([`Duas ${S}`]);
  });

  it("'sem' mostra só as que ainda não têm fábrica; 'todas' não filtra", async () => {
    expect(await nomesDe(whereFabricaProspeccao("sem"))).toEqual([`Sem Fábrica ${S}`]);
    expect(await nomesDe(whereFabricaProspeccao("todas"))).toHaveLength(3);
  });
});

describe("ajustarFabricasProspeccao", () => {
  it("inclui e tira fábricas da prospecção, com auditoria do campo", async () => {
    const r = await ajustarFabricasProspeccao(autor, ids.semFabrica, { incluir: [bowden.id, rudolph.id], tirar: [] });
    expect(r).toEqual({ erros: [], fabricas: [`Bowden ${S}`, `Rudolph ${S}`] });
    const r2 = await ajustarFabricasProspeccao(autor, ids.semFabrica, { incluir: [], tirar: [bowden.id] });
    expect(r2.fabricas).toEqual([`Rudolph ${S}`]);
    expect(await fabricasDa(ids.semFabrica)).toEqual([`Rudolph ${S}`]);
    const eventos = await prisma.eventoAuditoria.findMany({ where: { entidadeId: ids.semFabrica, campo: "fabricasIds" }, orderBy: { criadoEm: "asc" } });
    expect(eventos).toHaveLength(2);
    expect(eventos[1].valorNovo).toBe(rudolph.id);
  });

  it("incluir a que já tem não duplica nem audita", async () => {
    const r = await ajustarFabricasProspeccao(autor, ids.rudolph, { incluir: [rudolph.id], tirar: [] });
    expect(r).toEqual({ erros: [], fabricas: [`Rudolph ${S}`] });
    expect(await prisma.eventoAuditoria.count({ where: { entidadeId: ids.rudolph } })).toBe(0);
  });

  it("recusa cliente (para cliente, as fábricas são as que ele compra: use a carteira)", async () => {
    const r = await ajustarFabricasProspeccao(autor, ids.cliente, { incluir: [rudolph.id], tirar: [] });
    expect(r.erros).toEqual(["Esta empresa já é cliente: as fábricas dela são as que compra. Para oferecer outra fábrica, use uma oportunidade da carteira."]);
    expect(await fabricasDa(ids.cliente)).toEqual([`Bowden ${S}`]);
  });

  it("recusa fábrica inativa ou inexistente", async () => {
    expect((await ajustarFabricasProspeccao(autor, ids.duas, { incluir: [inativa.id], tirar: [] })).erros).toEqual(["Fábrica desativada ou inexistente."]);
    expect((await ajustarFabricasProspeccao(autor, ids.duas, { incluir: ["nao-existe"], tirar: [] })).erros).toEqual(["Fábrica desativada ou inexistente."]);
  });
});

describe("ligarProspeccaoSemFabrica", () => {
  it("liga à fábrica só as empresas em prospecção que ainda não têm fábrica", async () => {
    const solta = await prisma.cliente.create({ data: { nomeFantasia: `Solta ${S}`, situacao: "PAUSADA", uf: "PA" } });
    const n = await ligarProspeccaoSemFabrica(prisma, rudolph.id);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await fabricasDa(solta.id)).toEqual([`Rudolph ${S}`]);
    expect(await fabricasDa(ids.duas)).toEqual([`Bowden ${S}`, `Rudolph ${S}`]);
    expect(await fabricasDa(ids.cliente)).toEqual([`Bowden ${S}`]);
  });
});

describe("criarEmpresaProspeccao com fábrica", () => {
  it("grava as fábricas e só alerta região quando é Rudolph", async () => {
    const r = await criarEmpresaProspeccao(autor, { nome: `Nova Bowden SP ${S}`, uf: "SP", fabricasIds: [bowden.id] });
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    expect(await fabricasDa(r.id!)).toEqual([`Bowden ${S}`]);

    const r2 = await criarEmpresaProspeccao(autor, { nome: `Nova Rudolph SP ${S}`, uf: "SP", fabricasIds: [rudolph.id] });
    expect(r2.avisos).toEqual(["Fora do Norte e Nordeste: a linha Rudolph não pode ser oferecida a esta empresa (regra do contrato)."]);
  });

  it("recusa fábrica inativa sem cadastrar nada", async () => {
    const r = await criarEmpresaProspeccao(autor, { nome: `Nova Inativa ${S}`, uf: "PE", fabricasIds: [inativa.id] });
    expect(r.erros).toEqual(["Fábrica desativada ou inexistente."]);
    expect(await prisma.cliente.count({ where: { nomeFantasia: `Nova Inativa ${S}` } })).toBe(0);
  });
});
