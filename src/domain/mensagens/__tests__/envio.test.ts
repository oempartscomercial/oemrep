import { describe, it, expect } from "vitest";
import { verificarEnvio, type ContextoDeEnvio } from "../envio";

const sp = (iso: string) => new Date(`${iso}-03:00`);
const AGORA = sp("2026-10-07T10:00:00"); // quarta, 10h em São Paulo
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);

function contexto(extra: Partial<ContextoDeEnvio> = {}): ContextoDeEnvio {
  return {
    agora: AGORA,
    tipo: "PRIMEIRO_CONTATO",
    texto: "Olá, tudo bem? Quem cuida da compra dessa linha aí?",
    empresa: { situacao: "APROVADA", naoContatar: false },
    contato: { naoContatar: false, origemContato: "PUBLICADO_PELA_EMPRESA" },
    numero: "+5547999998888",
    historico: [],
    primeirosContatosHoje: 0,
    limites: { horarioInicio: 8, horarioFim: 18, maxPrimeirosPorDia: 15, diasEntreMensagens: 3, maxTentativas: 3 },
    linha: "conectada",
    ...extra,
  };
}
const codigos = (c: ContextoDeEnvio) => {
  const r = verificarEnvio(c);
  return r.ok ? [] : r.bloqueios.map((b) => b.codigo);
};
const enviada = (diasAtrasDe: number, texto = "msg") => ({ direcao: "SAIDA" as const, status: "ENVIADA", texto, ocorridoEm: diasAtras(diasAtrasDe) });
const recebida = (diasAtrasDe: number) => ({ direcao: "ENTRADA" as const, status: "RECEBIDA", texto: "oi", ocorridoEm: diasAtras(diasAtrasDe) });

describe("verificarEnvio — proteções fixas (ADR-015 §4)", () => {
  it("primeiro contato regular passa", () => {
    expect(verificarEnvio(contexto())).toEqual({ ok: true });
  });

  describe("quem pode receber", () => {
    it("contato ou empresa em 'não contatar' bloqueia de vez", () => {
      expect(codigos(contexto({ contato: { naoContatar: true, origemContato: "PUBLICADO_PELA_EMPRESA" } }))).toEqual(["nao_contatar"]);
      expect(codigos(contexto({ empresa: { situacao: "APROVADA", naoContatar: true } }))).toEqual(["nao_contatar"]);
      expect(verificarEnvio(contexto({ empresa: { situacao: "APROVADA", naoContatar: true } }))).toMatchObject({ bloqueios: [{ espera: false }] });
    });

    it.each([
      ["CANDIDATA", "empresa_nao_aprovada"],
      ["DESCARTADA", "empresa_descartada"],
      ["PAUSADA", "empresa_pausada"],
      ["CLIENTE", "cliente_atual"],
    ])("empresa %s não recebe pela linha de prospecção", (situacao, codigo) => {
      expect(codigos(contexto({ empresa: { situacao, naoContatar: false } }))).toEqual([codigo]);
    });

    it.each(["APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO"])("empresa %s pode", (situacao) => {
      const tipo = situacao === "APROVADA" ? "PRIMEIRO_CONTATO" : "RESPOSTA";
      const historico = tipo === "RESPOSTA" ? [recebida(1)] : [];
      expect(codigos(contexto({ tipo, historico, empresa: { situacao, naoContatar: false } }))).toEqual([]);
    });

    it("sem origem do contato, não envia", () => {
      expect(codigos(contexto({ contato: { naoContatar: false, origemContato: null } }))).toEqual(["sem_origem"]);
    });

    it("número inválido não envia", () => {
      expect(codigos(contexto({ numero: null }))).toEqual(["numero_invalido"]);
    });
  });

  describe("quando pode sair (esperar resolve)", () => {
    it("fora do horário comercial espera", () => {
      const r = verificarEnvio(contexto({ agora: sp("2026-10-07T21:00:00") }));
      expect(r).toMatchObject({ ok: false, bloqueios: [{ codigo: "fora_do_horario", espera: true }] });
    });
    it("fim de semana espera", () => {
      expect(codigos(contexto({ agora: sp("2026-10-10T11:00:00") }))).toEqual(["fora_do_horario"]);
    });
    it("linha desconectada ou sem resposta espera", () => {
      expect(verificarEnvio(contexto({ linha: "desconectada" }))).toMatchObject({ bloqueios: [{ codigo: "linha_desconectada", espera: true }] });
      expect(verificarEnvio(contexto({ linha: "desconhecida" }))).toMatchObject({ bloqueios: [{ codigo: "linha_desconhecida", espera: true }] });
    });
    it("limite de primeiros contatos do dia", () => {
      expect(codigos(contexto({ primeirosContatosHoje: 14 }))).toEqual([]);
      expect(verificarEnvio(contexto({ primeirosContatosHoje: 15 }))).toMatchObject({ bloqueios: [{ codigo: "limite_diario", espera: true }] });
    });
  });

  describe("primeiro contato", () => {
    it("não é primeiro contato se já houve conversa", () => {
      expect(codigos(contexto({ historico: [enviada(10)] }))).toEqual(["ja_ha_conversa"]);
      expect(codigos(contexto({ historico: [recebida(10)] }))).toEqual(["ja_ha_conversa"]);
    });
    it("rascunho, falha e cancelada não contam como conversa", () => {
      const lixo = ["RASCUNHO", "APROVADA", "FALHOU", "CANCELADA"].map((status) => ({ direcao: "SAIDA" as const, status, texto: "x", ocorridoEm: diasAtras(5) }));
      expect(codigos(contexto({ historico: lixo }))).toEqual([]);
    });
  });

  describe("follow-up", () => {
    const followUp = (historico: ContextoDeEnvio["historico"], texto = "Passando para saber se viu a mensagem.") =>
      contexto({ tipo: "FOLLOW_UP", historico, texto, empresa: { situacao: "EM_CONTATO", naoContatar: false } });

    it("passa depois do intervalo, sem resposta e com tentativas sobrando", () => {
      expect(codigos(followUp([enviada(3)]))).toEqual([]);
    });
    it("antes do intervalo espera (conta também o que o Rômulo digitou no celular)", () => {
      expect(verificarEnvio(followUp([enviada(2)]))).toMatchObject({ bloqueios: [{ codigo: "intervalo", espera: true }] });
    });
    it("se o contato respondeu depois da última saída, é caso de responder, não de follow-up", () => {
      expect(verificarEnvio(followUp([enviada(6), recebida(4)]))).toMatchObject({ bloqueios: [{ codigo: "contato_respondeu", espera: false }] });
    });
    it("no máximo 3 tentativas sem resposta", () => {
      expect(codigos(followUp([enviada(12, "a"), enviada(9, "b"), enviada(6, "c")]))).toEqual(["max_tentativas"]);
      expect(codigos(followUp([enviada(12, "a"), enviada(9, "b")]))).toEqual([]);
    });
    it("a contagem de tentativas recomeça depois de uma resposta", () => {
      expect(codigos(followUp([enviada(30, "a"), enviada(28, "b"), enviada(26, "c"), recebida(20), enviada(10, "d")]))).toEqual([]);
    });
    it("sem nenhuma mensagem enviada não há o que acompanhar", () => {
      expect(codigos(followUp([]))).toEqual(["nada_para_acompanhar"]);
    });
    it("não depende do limite diário de primeiros contatos", () => {
      expect(codigos({ ...followUp([enviada(5)]), primeirosContatosHoje: 99 })).toEqual([]);
    });
  });

  describe("resposta", () => {
    const resposta = (historico: ContextoDeEnvio["historico"]) =>
      contexto({ tipo: "RESPOSTA", historico, texto: "Segue o catálogo.", empresa: { situacao: "CONVERSANDO", naoContatar: false } });

    it("só existe se o contato escreveu", () => {
      expect(codigos(resposta([]))).toEqual(["sem_mensagem_para_responder"]);
      expect(codigos(resposta([enviada(3)]))).toEqual(["sem_mensagem_para_responder"]);
      expect(codigos(resposta([enviada(3), recebida(1)]))).toEqual([]);
    });
    it("não tem limite de intervalo, de tentativas nem diário", () => {
      expect(codigos({ ...resposta([enviada(1), recebida(0.5)]), primeirosContatosHoje: 99 })).toEqual([]);
    });
    it("continua sujeita a horário, origem e supressão", () => {
      const fora = { ...resposta([recebida(1)]), agora: sp("2026-10-07T22:00:00") };
      expect(codigos(fora)).toEqual(["fora_do_horario"]);
    });
  });

  it("mensagem idêntica a uma já enviada é duplicata", () => {
    const c = contexto({ tipo: "RESPOSTA", empresa: { situacao: "CONVERSANDO", naoContatar: false }, texto: "Segue o catálogo.", historico: [recebida(2), enviada(1, "  Segue o catálogo. ")] });
    expect(codigos(c)).toEqual(["duplicada"]);
  });

  it("junta todos os motivos de uma vez para a tela mostrar a lista inteira", () => {
    const c = contexto({ agora: sp("2026-10-10T11:00:00"), numero: null, linha: "desconectada", contato: { naoContatar: false, origemContato: null } });
    expect(codigos(c).sort()).toEqual(["fora_do_horario", "linha_desconectada", "numero_invalido", "sem_origem"]);
  });

  it("todo bloqueio tem texto em português para a tela", () => {
    const r = verificarEnvio(contexto({ numero: null }));
    expect(r.ok === false && r.bloqueios[0].texto).toBe("O número deste contato não é um telefone válido.");
  });
});
