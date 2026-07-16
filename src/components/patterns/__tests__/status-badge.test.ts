import { describe, expect, test } from "vitest";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";

describe("statusBadgeConfig", () => {
  test("pedido COMPLETO → verde", () => {
    expect(statusBadgeConfig("pedido", "COMPLETO")).toEqual({ label: "Completo", color: "success" });
  });
  test("pedido SEM_NFE → cinza", () => {
    expect(statusBadgeConfig("pedido", "SEM_NFE")).toEqual({ label: "Sem NFe", color: "gray" });
  });
  test("pedido PARCIAL → âmbar", () => {
    expect(statusBadgeConfig("pedido", "PARCIAL")).toEqual({ label: "Parcial", color: "warning" });
  });
  test("pedido ARQUIVADO → cinza", () => {
    expect(statusBadgeConfig("pedido", "ARQUIVADO")).toEqual({ label: "Arquivado", color: "gray" });
  });
  test("nfe EXTRAVIADO → vermelho (alerta)", () => {
    expect(statusBadgeConfig("nfe", "EXTRAVIADO")).toEqual({ label: "Extraviado", color: "error" });
  });
  test("nfe TRANSITO → azul", () => {
    expect(statusBadgeConfig("nfe", "TRANSITO")).toEqual({ label: "Em trânsito", color: "blue" });
  });
  test("nfe ARMAZENADA → verde", () => {
    expect(statusBadgeConfig("nfe", "ARMAZENADA")).toEqual({ label: "Armazenada", color: "success" });
  });
  test("chamado RESOLVIDO → verde", () => {
    expect(statusBadgeConfig("chamado", "RESOLVIDO")).toEqual({ label: "Resolvido", color: "success" });
  });
  test("valor desconhecido → cinza com o próprio texto", () => {
    expect(statusBadgeConfig("pedido", "XPTO")).toEqual({ label: "XPTO", color: "gray" });
  });
});
