import { describe, it, expect } from "vitest";
import {
  transicaoRastreioValida,
  proximosStatusRastreio,
  STATUS_RASTREIO,
} from "../rastreio";

describe("transição de rastreio (ADR-008)", () => {
  it("permite TRANSITO → RECEBIDA", () => {
    expect(transicaoRastreioValida("TRANSITO", "RECEBIDA")).toBe(true);
  });
  it("permite RECEBIDA → ARMAZENADA", () => {
    expect(transicaoRastreioValida("RECEBIDA", "ARMAZENADA")).toBe(true);
  });
  it("permite o desvio TRANSITO → EXTRAVIADO", () => {
    expect(transicaoRastreioValida("TRANSITO", "EXTRAVIADO")).toBe(true);
  });
  it("rejeita pular etapas: TRANSITO → ARMAZENADA", () => {
    expect(transicaoRastreioValida("TRANSITO", "ARMAZENADA")).toBe(false);
  });
  it("rejeita retroceder: RECEBIDA → TRANSITO", () => {
    expect(transicaoRastreioValida("RECEBIDA", "TRANSITO")).toBe(false);
  });
  it("rejeita desvio a partir de RECEBIDA: RECEBIDA → EXTRAVIADO", () => {
    expect(transicaoRastreioValida("RECEBIDA", "EXTRAVIADO")).toBe(false);
  });
});

describe("próximos status de rastreio", () => {
  it("lista os próximos válidos a partir de TRANSITO", () => {
    expect(proximosStatusRastreio("TRANSITO")).toEqual(["RECEBIDA", "EXTRAVIADO"]);
  });
  it("lista ARMAZENADA como único próximo de RECEBIDA", () => {
    expect(proximosStatusRastreio("RECEBIDA")).toEqual(["ARMAZENADA"]);
  });
  it("trata ARMAZENADA como estado final", () => {
    expect(proximosStatusRastreio("ARMAZENADA")).toEqual([]);
  });
  it("trata EXTRAVIADO como estado final", () => {
    expect(proximosStatusRastreio("EXTRAVIADO")).toEqual([]);
  });
});

describe("catálogo de status", () => {
  it("expõe os quatro status na ordem do fluxo", () => {
    expect(STATUS_RASTREIO).toEqual(["TRANSITO", "RECEBIDA", "ARMAZENADA", "EXTRAVIADO"]);
  });
});
