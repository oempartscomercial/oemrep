import { PageHeader } from "@/components/patterns/page-header";
import { resumoDasIntegracoes } from "@/lib/integracoes/config";
import { origemDoApp } from "@/lib/origem";
import { PainelChatwoot, PainelEvolution } from "./paineis";

const quando = (d: Date | null) =>
  d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export default async function IntegracoesPage() {
  const [resumo, origem] = await Promise.all([resumoDasIntegracoes(), origemDoApp()]);
  const { evolution, chatwoot } = resumo;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo="Integrações"
        descricao="O WhatsApp de prospecção (Evolution) e a caixa de entrada (Chatwoot). As chaves ficam guardadas cifradas e nunca voltam para a tela: só aparece o final."
      />
      {!resumo.cifraConfigurada && (
        <section role="alert" className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <p className="font-semibold text-warning">Falta configurar a chave de cifra no servidor</p>
          <p className="mt-0.5">
            Para guardar as chaves com segurança, o servidor precisa da variável <code className="font-mono text-xs">INTEGRACOES_CHAVE</code> (na Vercel). Sem ela, nada pode ser salvo aqui. Peça ao Arthur.
          </p>
        </section>
      )}
      <PainelEvolution
        podeSalvar={resumo.cifraConfigurada}
        enderecoDoWebhook={`${origem}/api/whatsapp/prospeccao/webhook`}
        config={
          evolution
            ? {
                url: evolution.url,
                instancia: evolution.instancia,
                segredo: evolution.segredo,
                envioAutomatico: evolution.envioAutomatico,
                origem: evolution.origem,
                webhookConfiguradoEm: quando(evolution.webhookConfiguradoEm),
                ultimoAviso: evolution.estadoConexao ? { estado: evolution.estadoConexao, em: quando(evolution.estadoConexaoEm)! } : null,
                atualizadoPor: evolution.atualizadoPor,
              }
            : null
        }
      />
      <PainelChatwoot
        podeSalvar={resumo.cifraConfigurada}
        config={chatwoot ? { url: chatwoot.url, conta: chatwoot.conta, segredo: chatwoot.segredo, atualizadoPor: chatwoot.atualizadoPor } : null}
      />
    </div>
  );
}
