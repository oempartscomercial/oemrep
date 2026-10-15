"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Copy, KeyRound, Plug, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoTexto } from "@/components/patterns/campo";
import { Selo } from "@/components/patterns/status-badge";
import { useClipboard } from "@/hooks/use-clipboard";
import { configuracaoClaudeCode, configuracaoClaudeCodeOAuth, urlDoConector, urlDoServidorMcp } from "@/domain/mcp/conexao";
import { gerarAcessoClaude, revogarAcessoClaude } from "./actions";

export type AcessoLinha = {
  id: string;
  nome: string;
  prefixo: string;
  /** OAUTH: conectado pelo "Permitir" do Claude. MANUAL: token gerado aqui (Avançado). */
  origem: "MANUAL" | "OAUTH";
  /** OAuth parado há mais de 90 dias: precisa conectar de novo. */
  expirado: boolean;
  /** Preenchido só quando o acesso é de outra pessoa (ADMIN vê todos). */
  dono: string | null;
  criadoEm: string;
  ultimoUsoEm: string | null;
  revogadoEm: string | null;
};

function BlocoCopiavel({ titulo, passos, valor, id }: { titulo: string; passos: string; valor: string; id: string }) {
  const { copied, copy } = useClipboard();
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <Botao variante="secundario" className="h-11 md:h-8" icone={copied === id ? <Check /> : <Copy />} onClick={() => copy(valor, id)}>
          {copied === id ? "Copiado" : "Copiar"}
        </Botao>
      </div>
      <p className="text-xs text-muted-foreground">{passos}</p>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{valor}</pre>
    </section>
  );
}

function SeloSituacao({ acesso }: { acesso: AcessoLinha }) {
  if (acesso.revogadoEm) return <Selo cor="gray">Revogado</Selo>;
  if (acesso.expirado) return <Selo cor="warning">Expirado</Selo>;
  return <Selo cor="success">Ativo</Selo>;
}

/**
 * Como conectar (o jeito principal é o OAuth: só o endereço, e o Claude pede "Permitir"), a lista
 * de acessos para revogar e, em Avançado, o token manual (mostrado uma vez).
 */
export function PainelConexao({ acessos, origem, nomeSugerido }: { acessos: AcessoLinha[]; origem: string; nomeSugerido: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeSugerido);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ url: string; config: string } | null>(null);
  const [mostrando, setMostrando] = useState(false);
  const [revogando, setRevogando] = useState<AcessoLinha | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroRevogar, setErroRevogar] = useState<string | null>(null);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarAcessoClaude({ nome });
      if (r.erros.length > 0 || !r.token) {
        setErro(r.erros[0] ?? "Não foi possível gerar agora. Tente de novo.");
        return;
      }
      const origem = window.location.origin;
      setNovo({ url: urlDoConector(origem, r.token), config: configuracaoClaudeCode(origem, r.token) });
      setMostrando(true);
      router.refresh();
    } catch {
      setErro("Não foi possível gerar agora. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function revogar() {
    if (!revogando) return;
    setOcupado(true);
    setErroRevogar(null);
    try {
      const r = await revogarAcessoClaude({ id: revogando.id });
      if (r.erros.length > 0) {
        setErroRevogar(r.erros[0]);
        return;
      }
      setRevogando(null);
      router.refresh();
    } catch {
      setErroRevogar("Não foi possível revogar agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  // O segredo sai da memória da tela logo depois que a janela fecha (o atraso é só a animação).
  function fecharNovo() {
    setMostrando(false);
    setTimeout(() => setNovo(null), 300);
  }

  const ativos = acessos.filter((a) => !a.revogadoEm && !a.expirado);

  return (
    <>
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Como conectar</h2>
          <p className="text-xs text-muted-foreground">Não precisa copiar código: o Claude abre esta plataforma no navegador e você clica em Permitir.</p>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <BlocoCopiavel
            id="oauth-url"
            titulo="No Claude (site, aplicativo do computador ou celular)"
            passos="Abra Configurações → Conectores → Adicionar conector personalizado. Dê o nome OEM, cole este endereço e clique em Adicionar. Depois clique em Conectar: o navegador abre aqui e você clica em Permitir."
            valor={urlDoServidorMcp(origem)}
          />
          <BlocoCopiavel
            id="oauth-config"
            titulo="No Claude Code (arquivo .mcp.json)"
            passos="Cole no arquivo .mcp.json da pasta onde o Claude Code roda (se o arquivo já existir, junte o bloco “oem” dentro de “mcpServers”). No Claude Code, digite /mcp, escolha oem e Autenticar: o navegador abre aqui e você clica em Permitir."
            valor={configuracaoClaudeCodeOAuth(origem)}
          />
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Acessos ({ativos.length} ativo{ativos.length === 1 ? "" : "s"})</h2>
        </div>
        {acessos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum acesso ainda. Conecte o Claude como explicado acima.</p>
        ) : (
          <ul className="divide-y px-4">
            {acessos.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3 text-sm md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {a.origem === "OAUTH" ? <Plug className="size-3.5 text-muted-foreground" /> : <KeyRound className="size-3.5 text-muted-foreground" />}
                    {a.nome}
                    {a.origem === "MANUAL" && <span className="font-mono text-xs text-muted-foreground">{a.prefixo}…</span>}
                    <SeloSituacao acesso={a} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.dono ? `De ${a.dono} · ` : ""}
                    {a.origem === "OAUTH" ? `Autorizado no Claude em ${a.criadoEm}` : `Token manual criado em ${a.criadoEm}`} ·{" "}
                    {a.ultimoUsoEm ? `último uso em ${a.ultimoUsoEm}` : "ainda não usado"}
                    {a.revogadoEm ? ` · revogado em ${a.revogadoEm}` : ""}
                  </p>
                </div>
                {!a.revogadoEm && !a.expirado && (
                  <Botao variante="ghost" className="h-11 self-start md:h-8 md:self-auto" onClick={() => setRevogando(a)}>
                    Revogar
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="group rounded-lg border bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold md:min-h-0 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          Avançado: token manual
        </summary>
        <div className="border-t">
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            Para quem não consegue usar o Permitir (por exemplo, um programa sem navegador). O token aparece uma vez, não vence e dá acesso ao CRM em seu nome até ser revogado.
          </p>
          <div className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
            <CampoTexto className="md:max-w-sm md:flex-1" rotulo="Nome do acesso" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} erro={erro ?? undefined} maxLength={80} />
            <Botao variante="primario" className="h-11 md:h-9" icone={<Plus />} carregando={gerando} onClick={gerar} disabled={!nome.trim()}>
              Gerar token
            </Botao>
          </div>
        </div>
      </details>

      <Dialog open={mostrando} onOpenChange={(aberto) => !aberto && fecharNovo()}>
        <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Token gerado</DialogTitle>
            <DialogDescription>
              Copie agora: o código aparece só esta vez. Quem tiver este endereço entra no CRM em seu nome, então não compartilhe. Se vazar, revogue e gere outro.
            </DialogDescription>
          </DialogHeader>
          {novo && (
            <div className="flex flex-col gap-3">
              <BlocoCopiavel
                id="url"
                titulo="No claude.ai (conector personalizado)"
                passos="Em claude.ai, abra Configurações → Conectores → Adicionar conector personalizado. Dê o nome OEM e cole este endereço."
                valor={novo.url}
              />
              <BlocoCopiavel
                id="config"
                titulo="No Claude Code (arquivo .mcp.json)"
                passos="Cole no arquivo .mcp.json da pasta onde o Claude Code roda (se o arquivo já existir, junte o bloco “oem” dentro de “mcpServers”)."
                valor={novo.config}
              />
            </div>
          )}
          <DialogFooter>
            <Botao variante="primario" className="h-11 md:h-9" onClick={fecharNovo}>
              Já copiei
            </Botao>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revogando !== null} onOpenChange={(aberto) => !aberto && (setRevogando(null), setErroRevogar(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar “{revogando?.nome}”?</DialogTitle>
            <DialogDescription>
              {revogando?.origem === "OAUTH"
                ? "O Claude que usa esta conexão perde o acesso na hora. Para voltar, conecte de novo pelo Claude: ele pede Permitir outra vez."
                : "O Claude que usa este token perde a conexão na hora. Não dá para desfazer: para voltar, gere um token novo."}
            </DialogDescription>
          </DialogHeader>
          {erroRevogar && <p className="text-sm text-destructive">{erroRevogar}</p>}
          <DialogFooter>
            <Botao variante="ghost" className="h-11 md:h-9" onClick={() => setRevogando(null)}>
              Cancelar
            </Botao>
            <Botao variante="destrutivo" className="h-11 md:h-9" carregando={ocupado} onClick={revogar}>
              Revogar
            </Botao>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
