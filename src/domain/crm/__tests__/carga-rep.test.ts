import { describe, it, expect } from "vitest";
import { canalDaLinha, chaveDeNome, clientesDaGrade, cnpjDoRotulo, fabricaDoArquivo, indicePorNome, juntarClientes, origemDoContato } from "../carga-rep";

describe("origemDoContato", () => {
  it("só é publicado pela empresa quando a fonte é a página dela", () => {
    expect(origemDoContato({ canal: "WHATSAPP", fonte: "https://loja.example/contato", status: "publicado no site" })).toBe("PUBLICADO_PELA_EMPRESA");
    expect(origemDoContato({ canal: "EMAIL", fonte: "https://www.linkedin.com/company/x", status: null })).toBeNull();
    expect(origemDoContato({ canal: "TELEFONE", fonte: "https://brasilapi.com.br/api/cnpj/v1/1", status: null })).toBeNull();
    expect(origemDoContato({ canal: "WHATSAPP", fonte: "Quadro de sócios", status: null })).toBeNull();
    expect(origemDoContato({ canal: "WHATSAPP", fonte: "https://loja.example", status: "não confirmado: não usar" })).toBeNull();
    expect(origemDoContato({ canal: "LINKEDIN", fonte: "https://loja.example", status: null })).toBeNull();
  });
});

describe("nomes", () => {
  it("chave ignora acento, caixa e pontuação", () => {
    expect(chaveDeNome(" Padre Cícero - CE ")).toBe("PADRE CICERO CE");
  });
  it("canal pessoa vira outro", () => {
    expect(canalDaLinha("pessoa")).toBe("outro");
    expect(canalDaLinha("whatsapp")).toBe("whatsapp");
  });
  it("arquivo da planilha aponta a fábrica", () => {
    expect(fabricaDoArquivo("SEINECA - COMPACTADA.xlsx")).toBe("Seineca/H3");
    expect(fabricaDoArquivo("outra.xlsx")).toBeNull();
  });
});

describe("casamento pelo rótulo", () => {
  const indice = indicePorNome([
    { cnpj: "1", nomes: ["ARAUTHO - TO"], fabricas: ["Autoflex"] },
    { cnpj: "2", nomes: ["DISPETRAL", "REPETIDO"], fabricas: ["Bowden"] },
    { cnpj: "3", nomes: ["REPETIDO"], fabricas: ["Bowden"] },
  ]);
  it("acha o CNPJ por qualquer rótulo e ignora o ambíguo", () => {
    expect(cnpjDoRotulo("Arautho - TO", indice)).toBe("1");
    expect(cnpjDoRotulo("X; Dispetral", indice)).toBe("2");
    expect(cnpjDoRotulo("REPETIDO", indice)).toBeNull();
  });
  it("rótulos que apontam para CNPJs diferentes não casam", () => {
    expect(cnpjDoRotulo("ARAUTHO - TO; DISPETRAL", indice)).toBeNull();
  });
});

describe("clientesDaGrade", () => {
  it("lê CNPJ e fantasia abaixo do cabeçalho, conta as linhas e junta entre abas", () => {
    const grade = [
      ["TÍTULO"],
      ["CNPJ", "NOME FANTASIA"],
      [7965809000520, "FILIAL-04"],
      ["07.965.809/0005-20", "FILIAL-04"],
      [7965809000520, "ARAUTHO - TO"],
      ["", "SEM CNPJ"],
      ["07.965.809/0005-21", "DÍGITO ERRADO"],
    ];
    const a = clientesDaGrade(grade, "Autoflex");
    expect(a).toEqual([{ cnpj: "07965809000520", nomes: ["FILIAL-04", "ARAUTHO - TO"], fabricas: ["Autoflex"], linhas: { "FILIAL-04": 2, "ARAUTHO - TO": 1 } }]);
    expect(clientesDaGrade([["A", "B"]], "Autoflex")).toEqual([]);
    const b = clientesDaGrade([["CNPJ", "FANTASIA"], [7965809000520, "ARAUTHO - TO"], [7965809000520, "ARAUTHO - TO"], [7965809000520, "ARAUTHO - TO"]], "Bowden");
    const [junto] = juntarClientes([a, b]);
    expect(junto.nomes).toEqual(["ARAUTHO - TO", "FILIAL-04"]);
    expect(junto.fabricas).toEqual(["Autoflex", "Bowden"]);
  });

  it("rótulo digitado errado em poucas linhas de outro CNPJ fica com o CNPJ da maioria", () => {
    const indice = indicePorNome([
      { cnpj: "07965809003627", nomes: ["FILIAL-35", "ARAUTHO - TO"], fabricas: [], linhas: { "FILIAL-35": 859, "ARAUTHO - TO": 13 } },
      { cnpj: "10014141000206", nomes: ["ARAUTHO - TO"], fabricas: [], linhas: { "ARAUTHO - TO": 72 } },
    ]);
    expect(cnpjDoRotulo("ARAUTHO - TO", indice)).toBe("10014141000206");
    expect(cnpjDoRotulo("FILIAL-35", indice)).toBe("07965809003627");
  });
});
