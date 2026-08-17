import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SessaoExpirada } from "../sessao-expirada";

const html = () => renderToStaticMarkup(createElement(SessaoExpirada));

describe("SessaoExpirada", () => {
  test("diz o que aconteceu", () => {
    expect(html()).toContain("Sessão expirada");
  });

  // O defeito que este componente existe para corrigir: a tela dizia
  // "faça login novamente" sem oferecer nenhuma forma de fazer login.
  test("oferece um caminho de volta para /login", () => {
    expect(html()).toMatch(/<a[^>]+href="\/login"/);
  });
});
