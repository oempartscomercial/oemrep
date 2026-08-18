import { interpretarTextoPdf } from "@/domain/importacao/pdf-texto";
import type { ExtracaoBrutaPdf } from "@/domain/importacao/pdf";

/**
 * Lê o texto da camada de texto do PDF e devolve o pedido no formato cru — de graça e
 * offline, sem chamar nenhuma API. Toda a regra de reconstrução da tabela é do domínio
 * (`interpretarTextoPdf`); aqui só existe a biblioteca de leitura do PDF.
 *
 * Funciona em PDF nativo (Bling: Bowden, Autoflex), que é o caso real. Um PDF escaneado
 * (imagem) devolve texto vazio — aí a tela avisa e o operador digita, ou liga-se a leitura
 * por IA depois.
 */
export class ExtracaoPdfSemTexto extends Error {}

/**
 * O pdf.mjs cria um `new DOMMatrix()` no escopo do módulo. No Node, o pdfjs polyfilla
 * isso com o pacote opcional @napi-rs/canvas — presente no dev local, mas o binário
 * nativo não é levado para a lambda da Vercel, e o import inteiro morria com
 * "ReferenceError: DOMMatrix is not defined" (erro visto em produção).
 *
 * Como só extraímos TEXTO (nada é desenhado), um stub identidade basta: o único uso da
 * matriz no pdfjs é em desenho de path, caminho que a extração de texto nunca executa.
 */
function polyfillDomMatrix(): void {
  const g = globalThis as { DOMMatrix?: unknown };
  if (g.DOMMatrix) return;
  g.DOMMatrix = class DOMMatrixStub {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    translate() { return this; }
    scale() { return this; }
    multiplySelf() { return this; }
    preMultiplySelf() { return this; }
    invertSelf() { return this; }
  };
}

export async function extrairPedidoDoTextoPdf(pdf: Buffer): Promise<ExtracaoBrutaPdf> {
  polyfillDomMatrix();

  // Import dinâmico: o pdfjs é pesado e só carrega quando alguém importa um PDF.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // No Node, o pdfjs sobe um "fake worker" importando pdf.worker.mjs por um caminho
  // calculado em runtime — que empacotadores (a lambda da Vercel inclusive) não rastreiam,
  // e a leitura morria com "Setting up fake worker failed". Com globalThis.pdfjsWorker
  // definido, o pdfjs usa o handler direto e nunca tenta esse import. O especificador
  // literal abaixo é rastreável por qualquer bundler.
  if (!(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker) {
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = await import(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
  }

  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
  const doc = await task.promise;

  const linhas: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const conteudo = await page.getTextContent();

      // Reagrupa os fragmentos por linha (Y arredondado) e ordena da esquerda para a
      // direita (X), reconstruindo cada linha impressa do PDF.
      const porLinha = new Map<number, { x: number; texto: string }[]>();
      for (const item of conteudo.items) {
        if (!("str" in item)) continue;
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        const grupo = porLinha.get(y) ?? [];
        grupo.push({ x, texto: item.str });
        porLinha.set(y, grupo);
      }

      const ordenadas = [...porLinha.entries()].sort((a, b) => b[0] - a[0]);
      for (const [, frags] of ordenadas) {
        const linha = frags
          .sort((a, b) => a.x - b.x)
          .map((f) => f.texto)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (linha) linhas.push(linha);
      }
    }
  } finally {
    await task.destroy();
  }

  const texto = linhas.join("\n");
  if (!texto.trim()) {
    throw new ExtracaoPdfSemTexto(
      "Este PDF não tem texto para ler (parece escaneado). Digite os itens à mão ou envie o PDF original do sistema.",
    );
  }

  return interpretarTextoPdf(texto);
}
