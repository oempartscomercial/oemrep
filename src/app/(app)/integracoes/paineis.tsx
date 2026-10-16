"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Inbox, MessageCircle, QrCode, RefreshCw, Webhook } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoCheckbox, CampoTexto } from "@/components/patterns/campo";
import { Selo } from "@/components/patterns/status-badge";
import { formatarNumero } from "@/domain/mensagens/exibicao";
import type { EstadoDaInstancia } from "@/lib/integracoes/evolution-api";
import {
  configurarWebhookAcao,
  criarInstanciaAcao,
  estadoEvolutionAcao,
  qrCodeAcao,
  salvarChatwootAcao,
  salvarEvolutionAcao,
  testarChatwootAcao,
  testarEvolutionAcao,
} from "./actions";

// Tela Integrações (ADR-019). O segredo salvo nunca chega aqui: só o final mascarado. Campo de
// chave vazio ao salvar = manter a que está guardada.

type Retorno = { tipo: "ok" | "erro" | "aviso"; texto: string } | null;

function Cartao({ icone, titulo, descricao, acao, children }: { icone: React.ReactNode; titulo: string; descricao: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 text-muted-foreground">{icone}</span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{titulo}</h2>
            <p className="text-xs text-muted-foreground">{descricao}</p>
          </div>
        </div>
        {acao}
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </section>
  );
}

function Mensagem({ retorno }: { retorno: Retorno }) {
  if (!retorno) return null;
  const cor = retorno.tipo === "ok" ? "text-success" : retorno.tipo === "aviso" ? "text-warning" : "text-destructive";
  return (
    <p role={retorno.tipo === "erro" ? "alert" : "status"} className={`text-sm font-medium ${cor}`}>
      {retorno.texto}
    </p>
  );
}

const ROTULO_ESTADO: Record<EstadoDaInstancia["estado"], { texto: string; cor: "success" | "warning" | "error" | "gray" }> = {
  conectada: { texto: "Conectado", cor: "success" },
  conectando: { texto: "Esperando o QR Code", cor: "warning" },
  desconectada: { texto: "Desconectado", cor: "error" },
  desconhecida: { texto: "Sem resposta", cor: "gray" },
};

function SeloDoEstado({ estado }: { estado: EstadoDaInstancia | null }) {
  if (!estado) return <Selo cor="gray">Verificando…</Selo>;
  if (!estado.existe) return <Selo cor="warning">Instância não existe</Selo>;
  const r = ROTULO_ESTADO[estado.estado];
  return <Selo cor={r.cor}>{r.texto}</Selo>;
}

// --- Evolution ------------------------------------------------------------------------------------

export type ConfigEvolutionNaTela = {
  url: string;
  instancia: string;
  segredo: string;
  envioAutomatico: boolean;
  origem: "tela" | "ambiente";
  webhookConfiguradoEm: string | null;
  ultimoAviso: { estado: string; em: string } | null;
  atualizadoPor: string | null;
};

export function PainelEvolution({ config, podeSalvar, enderecoDoWebhook }: { config: ConfigEvolutionNaTela | null; podeSalvar: boolean; enderecoDoWebhook: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(config?.url ?? "");
  const [instancia, setInstancia] = useState(config?.instancia || "prospeccao");
  const [apikey, setApikey] = useState("");
  const [envioAutomatico, setEnvioAutomatico] = useState(config?.envioAutomatico ?? false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [retorno, setRetorno] = useState<Retorno>(null);
  const [estado, setEstado] = useState<EstadoDaInstancia | null>(null);
  const [qrAberto, setQrAberto] = useState(false);
  const [confirmarWebhook, setConfirmarWebhook] = useState<string | null>(null);
  const salva = config !== null;
  const daTela = config?.origem === "tela";

  const atualizarEstado = useCallback(async () => {
    try {
      const r = await estadoEvolutionAcao();
      if (r.estado) setEstado(r.estado);
      return r.estado ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!salva) return;
    // Ao abrir a tela, pergunta à Evolution como está o celular.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void atualizarEstado();
  }, [salva, atualizarEstado]);

  async function rodar(nome: string, fn: () => Promise<Retorno | void>) {
    setOcupado(nome);
    setRetorno(null);
    try {
      const r = await fn();
      if (r) setRetorno(r);
    } catch {
      setRetorno({ tipo: "erro", texto: "Não foi possível agora. Tente de novo." });
    } finally {
      setOcupado(null);
    }
  }

  const salvar = () =>
    rodar("salvar", async () => {
      const r = await salvarEvolutionAcao({ url, instancia, apikey, envioAutomatico });
      if (r.erros.length) return { tipo: "erro", texto: r.erros.join(" ") };
      setApikey("");
      router.refresh();
      void atualizarEstado();
      return { tipo: "ok", texto: "Configuração da Evolution salva." };
    });

  const testar = () =>
    rodar("testar", async () => {
      const r = await testarEvolutionAcao();
      if (r.erros.length) return { tipo: "erro", texto: r.erros.join(" ") };
      if (r.estado) setEstado(r.estado);
      return { tipo: r.estado?.existe ? "ok" : "aviso", texto: r.mensagem ?? "Conexão OK." };
    });

  const criar = () =>
    rodar("criar", async () => {
      const r = await criarInstanciaAcao();
      if (r.erros.length) return { tipo: "erro", texto: r.erros.join(" ") };
      await atualizarEstado();
      setQrAberto(true);
      return { tipo: "ok", texto: `Instância "${instancia}" criada. Leia o QR Code com o celular de prospecção.` };
    });

  const webhook = (substituir = false) =>
    rodar("webhook", async () => {
      const r = await configurarWebhookAcao({ substituir });
      if (r.erros.length) return { tipo: "erro", texto: r.erros.join(" ") };
      if (r.precisaConfirmar) {
        setConfirmarWebhook(r.precisaConfirmar.urlAtual);
        return;
      }
      setConfirmarWebhook(null);
      router.refresh();
      return r.conferido
        ? { tipo: "ok", texto: "Webhook configurado e conferido: as mensagens do WhatsApp passam a chegar ao sistema." }
        : { tipo: "aviso", texto: "A Evolution aceitou o webhook, mas não confirmou a configuração ao ler de volta. Confira mandando uma mensagem de teste de um contato da base." };
    });

  return (
    <Cartao
      icone={<MessageCircle className="size-4" />}
      titulo="WhatsApp de prospecção (Evolution API)"
      descricao="O sistema envia as mensagens aprovadas, agenda e recebe as respostas por aqui."
      acao={
        salva ? (
          <div className="flex items-center gap-2">
            <SeloDoEstado estado={estado} />
            {estado?.numero && <span className="text-xs text-muted-foreground tabular">{formatarNumero(estado.numero)}</span>}
            <Botao variante="ghost" className="h-11 md:h-7" icone={<RefreshCw />} aria-label="Atualizar situação" onClick={() => void atualizarEstado()} />
          </div>
        ) : undefined
      }
    >
      {config?.origem === "ambiente" && (
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
          Hoje vale a configuração das variáveis do servidor (EVOLUTION_*). Ao salvar aqui, esta tela passa a valer no lugar delas.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <CampoTexto rotulo="Endereço da Evolution" name="evolution-url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
        <CampoTexto rotulo="Nome da instância" name="evolution-instancia" value={instancia} onChange={(e) => setInstancia(e.target.value)} autoComplete="off" />
        <CampoTexto
          rotulo="Chave (API key)"
          name="evolution-apikey"
          type="password"
          autoComplete="new-password"
          value={apikey}
          onChange={(e) => setApikey(e.target.value)}
          placeholder={daTela ? `${config!.segredo} — deixe vazio para manter` : "Cole a chave da Evolution"}
          dica={daTela ? `Guardada: ${config!.segredo}${config!.atualizadoPor ? ` (por ${config!.atualizadoPor})` : ""}.` : undefined}
        />
        <div className="flex items-end pb-1">
          <CampoCheckbox
            rotulo="Envio automático"
            dica="Ligado: a mensagem aprovada sai sozinha, dentro das regras (horário, limite do dia…). Desligado: depois de aprovar, a pessoa envia pelo celular e toca em “Já enviei”."
            marcado={envioAutomatico}
            aoMudar={setEnvioAutomatico}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Botao variante="primario" className="h-11 md:h-8" carregando={ocupado === "salvar"} disabled={!podeSalvar || ocupado !== null} onClick={salvar}>
          Salvar
        </Botao>
        <Botao className="h-11 md:h-8" carregando={ocupado === "testar"} disabled={!salva || ocupado !== null} onClick={testar}>
          Testar conexão
        </Botao>
        {estado && !estado.existe && (
          <Botao className="h-11 md:h-8" carregando={ocupado === "criar"} disabled={!daTela || ocupado !== null} onClick={criar}>
            Criar instância
          </Botao>
        )}
        {estado?.existe && estado.estado !== "conectada" && (
          <Botao className="h-11 md:h-8" icone={<QrCode />} disabled={ocupado !== null} onClick={() => setQrAberto(true)}>
            Conectar celular (QR Code)
          </Botao>
        )}
      </div>
      <Mensagem retorno={retorno} />

      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <Webhook className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">Receber as mensagens no sistema (webhook)</p>
              <p className="text-xs text-muted-foreground">
                {config?.webhookConfiguradoEm
                  ? `Configurado em ${config.webhookConfiguradoEm}. Só entram mensagens de números da base; conversas pessoais e grupos são ignorados.`
                  : "Ainda não configurado: as respostas não chegam ao sistema. A integração com o Chatwoot continua como está."}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">{enderecoDoWebhook}</p>
              {config?.ultimoAviso && (
                <p className="text-xs text-muted-foreground">
                  Último aviso de conexão: {config.ultimoAviso.estado === "open" ? "conectado" : config.ultimoAviso.estado === "close" ? "desconectado" : config.ultimoAviso.estado} em {config.ultimoAviso.em}.
                </p>
              )}
            </div>
          </div>
          <Botao className="h-11 md:h-8" carregando={ocupado === "webhook"} disabled={!daTela || !podeSalvar || ocupado !== null} onClick={() => webhook(false)}>
            {config?.webhookConfiguradoEm ? "Configurar de novo" : "Configurar webhook"}
          </Botao>
        </div>
      </div>

      {qrAberto && (
        <DialogoQrCode
          aoFechar={() => {
            setQrAberto(false);
            router.refresh();
          }}
          aoConectar={(e) => setEstado(e)}
        />
      )}

      {confirmarWebhook && (
        <Dialog open onOpenChange={(aberto) => !aberto && setConfirmarWebhook(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Trocar o webhook da instância?</DialogTitle>
              <DialogDescription>
                Hoje a instância manda os eventos para <span className="break-all font-mono text-xs">{confirmarWebhook}</span>. Se trocar, esse endereço deixa de receber. A integração com o Chatwoot não muda.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={() => setConfirmarWebhook(null)}>
                Manter como está
              </Botao>
              <Botao variante="primario" className="h-11 md:h-8" carregando={ocupado === "webhook"} onClick={() => webhook(true)}>
                Trocar para o sistema
              </Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Cartao>
  );
}

/** QR Code na própria tela: pergunta o estado a cada 3 s e renova o código a cada 30 s até conectar (no máximo 3 minutos). */
function DialogoQrCode({ aoFechar, aoConectar }: { aoFechar: () => void; aoConectar: (e: EstadoDaInstancia) => void }) {
  const [imagem, setImagem] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const [expirou, setExpirou] = useState(false);
  const inicio = useRef<number | null>(null);

  const pedirQr = useCallback(async () => {
    try {
      const r = await qrCodeAcao();
      if (r.erros.length) return setErro(r.erros.join(" "));
      if (r.conectado) return setConectado(true);
      setErro(null);
      setImagem(r.imagem ?? null);
      setCodigo(r.codigoPareamento ?? null);
    } catch {
      setErro("Não consegui pedir o QR Code agora.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void pedirQr();
  }, [pedirQr]);

  useEffect(() => {
    if (conectado || expirou) return;
    inicio.current ??= Date.now();
    let voltas = 0;
    const t = setInterval(async () => {
      voltas += 1;
      if (Date.now() - (inicio.current ?? Date.now()) > 3 * 60_000) {
        setExpirou(true);
        return;
      }
      try {
        const r = await estadoEvolutionAcao();
        if (r.estado?.estado === "conectada") {
          aoConectar(r.estado);
          setConectado(true);
          return;
        }
      } catch {
        // tenta de novo na próxima volta
      }
      if (voltas % 10 === 0) void pedirQr();
    }, 3000);
    return () => clearInterval(t);
  }, [conectado, expirou, pedirQr, aoConectar]);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{conectado ? "Celular conectado" : "Conectar o celular de prospecção"}</DialogTitle>
          <DialogDescription>
            {conectado ? "Pronto: o WhatsApp de prospecção está ligado ao sistema." : "No celular: WhatsApp → Aparelhos conectados → Conectar aparelho, e aponte para o código."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-64 flex-col items-center justify-center gap-2" aria-live="polite">
          {conectado ? (
            <CheckCircle2 className="size-16 text-success" aria-hidden />
          ) : expirou ? (
            <p className="text-center text-sm">O tempo acabou. Feche e abra de novo para gerar outro código.</p>
          ) : erro ? (
            <p role="alert" className="text-center text-sm text-destructive">{erro}</p>
          ) : imagem ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem em data: vinda da Evolution, não otimizável */}
              <img src={imagem} alt="QR Code para conectar o WhatsApp" className="size-64 rounded-md border bg-white p-2" />
              {codigo && <p className="text-xs text-muted-foreground">Ou use o código no celular: <span className="font-mono">{codigo}</span></p>}
              <p className="text-xs text-muted-foreground">O código se renova sozinho. Esta janela fecha quando conectar.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pedindo o QR Code…</p>
          )}
        </div>
        <DialogFooter>
          <Botao variante={conectado ? "primario" : "ghost"} className="h-11 md:h-8" onClick={aoFechar}>
            {conectado ? "Concluir" : "Fechar"}
          </Botao>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Chatwoot -------------------------------------------------------------------------------------

export function PainelChatwoot({ config, podeSalvar }: { config: { url: string; conta: string; segredo: string; atualizadoPor: string | null } | null; podeSalvar: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState(config?.url ?? "");
  const [conta, setConta] = useState(config?.conta ?? "1");
  const [token, setToken] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [retorno, setRetorno] = useState<Retorno>(null);

  async function rodar(nome: string, fn: () => Promise<Retorno>) {
    setOcupado(nome);
    setRetorno(null);
    try {
      setRetorno(await fn());
    } catch {
      setRetorno({ tipo: "erro", texto: "Não foi possível agora. Tente de novo." });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Cartao
      icone={<Inbox className="size-4" />}
      titulo="Caixa de entrada (Chatwoot)"
      descricao="Onde o Rômulo vê e responde as conversas do WhatsApp. A Evolution já alimenta o Chatwoot; aqui o sistema só guarda o acesso e testa."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <CampoTexto rotulo="Endereço do Chatwoot" name="chatwoot-url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
        <CampoTexto rotulo="Número da conta" name="chatwoot-conta" inputMode="numeric" value={conta} onChange={(e) => setConta(e.target.value)} autoComplete="off" />
        <CampoTexto
          rotulo="Token de acesso"
          name="chatwoot-token"
          type="password"
          autoComplete="new-password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={config ? `${config.segredo} — deixe vazio para manter` : "Perfil → Token de acesso"}
          dica={config ? `Guardado: ${config.segredo}${config.atualizadoPor ? ` (por ${config.atualizadoPor})` : ""}.` : undefined}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="primario"
          className="h-11 md:h-8"
          carregando={ocupado === "salvar"}
          disabled={!podeSalvar || ocupado !== null}
          onClick={() =>
            rodar("salvar", async () => {
              const r = await salvarChatwootAcao({ url, conta, token });
              if (r.erros.length) return { tipo: "erro", texto: r.erros.join(" ") };
              setToken("");
              router.refresh();
              return { tipo: "ok", texto: "Configuração do Chatwoot salva." };
            })
          }
        >
          Salvar
        </Botao>
        <Botao
          className="h-11 md:h-8"
          carregando={ocupado === "testar"}
          disabled={!config || ocupado !== null}
          onClick={() =>
            rodar("testar", async () => {
              const r = await testarChatwootAcao();
              return r.erros.length ? { tipo: "erro", texto: r.erros.join(" ") } : { tipo: "ok", texto: r.mensagem ?? "Conexão OK." };
            })
          }
        >
          Testar conexão
        </Botao>
      </div>
      <Mensagem retorno={retorno} />
    </Cartao>
  );
}
