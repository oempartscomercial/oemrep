import { AvatarPessoa } from "@/components/crm/avatar-iniciais";
import { PrazoSelo } from "@/components/crm/prazo-selo";
import { cn } from "@/lib/utils";

export type PassoCartao = { acao: string; prazo: string; responsavel: string } | null;

/** Próximo passo dentro do cartão do funil: o que fazer, o prazo em cor e quem faz. */
export function PassoDoCartao({ passo, hoje, semPasso, cobrar = false }: { passo: PassoCartao; hoje: string; semPasso: string; cobrar?: boolean }) {
  if (!passo) {
    return <p className={cn("text-xs", cobrar ? "font-medium text-warning" : "text-muted-foreground")}>{semPasso}</p>;
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/70 p-2">
      <p className="line-clamp-2 text-xs leading-snug">{passo.acao}</p>
      <div className="flex items-center justify-between gap-2">
        <PrazoSelo prazo={passo.prazo} hoje={hoje} />
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <AvatarPessoa nome={passo.responsavel} />
          <span className="truncate">{passo.responsavel.split(" ")[0]}</span>
        </span>
      </div>
    </div>
  );
}
