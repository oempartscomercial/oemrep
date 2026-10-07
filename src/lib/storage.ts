import { createClient } from "@supabase/supabase-js";

/**
 * Guarda o documento-fonte de uma importação num bucket privado do Supabase Storage.
 *
 * O PDF é a prova do que o cliente pediu: numa divergência com a fábrica, é o que se abre
 * ao lado dos itens. Por isso fica retido, diferente da planilha e do XML, que hoje são
 * descartados depois de lidos. Bucket privado — o acesso é sempre por URL assinada, curta.
 */
const BUCKET = "pedidos-importados";

// A chave de service-role só existe no servidor; nunca vai para o navegador.
function clienteStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Armazenamento de arquivos não configurado (falta SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, chave, { auth: { persistSession: false } });
}

export type ArquivoGuardado = {
  caminho: string;
  tamanhoBytes: number;
  mimeType: string;
};

/** Sobe o PDF e devolve o caminho no bucket, para gravar em ArquivoImportado. */
export async function guardarPdf(pdf: Buffer, nomeOriginal: string): Promise<ArquivoGuardado> {
  const storage = clienteStorage();
  // Sem Date/random no domínio; o caminho usa o instante e o nome saneado do arquivo.
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const seguro = nomeOriginal.replace(/[^\w.-]+/g, "_");
  const caminho = `${carimbo}-${seguro}`;

  const { error } = await storage.storage.from(BUCKET).upload(caminho, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw new Error(`Falha ao guardar o PDF: ${error.message}`);

  return { caminho, tamanhoBytes: pdf.length, mimeType: "application/pdf" };
}

/** URL temporária para abrir o PDF guardado (expira em uma hora). */
export async function urlAssinadaPdf(caminho: string): Promise<string | null> {
  const storage = clienteStorage();
  const { data, error } = await storage.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
