"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type OpcaoSelect = { id: string; label: string };

/** Rótulo + controle + dica/erro. Base dos campos abaixo e de controles avulsos. */
export function Campo({
  rotulo,
  htmlFor,
  obrigatorio,
  dica,
  erro,
  className,
  children,
}: {
  rotulo?: string;
  htmlFor?: string;
  obrigatorio?: boolean;
  dica?: string;
  erro?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {rotulo && (
        <Label htmlFor={htmlFor}>
          {rotulo}
          {obrigatorio && <span className="text-destructive"> *</span>}
        </Label>
      )}
      {children}
      {erro ? <p className="text-xs text-destructive">{erro}</p> : dica ? <p className="text-xs text-muted-foreground">{dica}</p> : null}
    </div>
  );
}

type CampoBase = { rotulo?: string; dica?: string; erro?: string; obrigatorio?: boolean };

export function CampoTexto({ rotulo, dica, erro, obrigatorio, className, id, name, ...props }: CampoBase & ComponentProps<typeof Input>) {
  const campoId = id ?? name;
  return (
    <Campo rotulo={rotulo} htmlFor={campoId} obrigatorio={obrigatorio} dica={dica} erro={erro} className={className}>
      <Input id={campoId} name={name} required={obrigatorio} aria-invalid={erro ? true : undefined} {...props} />
    </Campo>
  );
}

export function CampoTextarea({ rotulo, dica, erro, obrigatorio, className, id, name, ...props }: CampoBase & ComponentProps<typeof Textarea>) {
  const campoId = id ?? name;
  return (
    <Campo rotulo={rotulo} htmlFor={campoId} obrigatorio={obrigatorio} dica={dica} erro={erro} className={className}>
      <Textarea id={campoId} name={name} required={obrigatorio} aria-invalid={erro ? true : undefined} {...props} />
    </Campo>
  );
}

/**
 * Select por lista de opções {id, label}. Funciona em <form method="get"> (envia o
 * valor pelo `name`). `semOpcao` cria uma opção vazia ("Todos") com valor "".
 */
export function CampoSelect({
  rotulo,
  dica,
  erro,
  obrigatorio,
  className,
  name,
  opcoes,
  valorPadrao,
  valor,
  aoMudar,
  placeholder = "Selecione…",
  desabilitado,
  ariaLabel,
}: CampoBase & {
  /** Nome acessível quando não há `rotulo` visível (ex.: select por linha de tabela). */
  ariaLabel?: string;
  className?: string;
  name?: string;
  opcoes: OpcaoSelect[];
  valorPadrao?: string;
  valor?: string;
  aoMudar?: (valor: string) => void;
  placeholder?: string;
  desabilitado?: boolean;
}) {
  // Radix Select não aceita value="": usa um sentinela e o converte de volta.
  const VAZIO = "__vazio__";
  // Sem opção "" na lista, valor vazio significa "nada escolhido" (mostra o placeholder).
  const temOpcaoVazia = opcoes.some((o) => o.id === "");
  const paraRadix = (v?: string) => (v === "" ? (temOpcaoVazia ? VAZIO : undefined) : v);

  // O valor vive aqui (e `valor` o sobrescreve quando controlado): o Radix só mostra o texto
  // do item escolhido depois da 1ª abertura, então o rótulo é passado explicitamente.
  const [interno, setInterno] = useState(valorPadrao ?? "");
  const atual = valor ?? interno;
  const rotuloAtual = opcoes.find((o) => o.id === atual)?.label;

  return (
    <Campo rotulo={rotulo} htmlFor={name} obrigatorio={obrigatorio} dica={dica} erro={erro} className={className}>
      <Select
        name={name}
        value={paraRadix(atual)}
        onValueChange={(v) => {
          const novo = v === VAZIO ? "" : v;
          setInterno(novo);
          aoMudar?.(novo);
        }}
        disabled={desabilitado}
        required={obrigatorio}
      >
        <SelectTrigger id={name} className="w-full" aria-label={ariaLabel} aria-invalid={erro ? true : undefined}>
          <SelectValue placeholder={placeholder}>{rotuloAtual}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.id || VAZIO} value={o.id === "" ? VAZIO : o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );
}

export function CampoCheckbox({
  rotulo,
  dica,
  name,
  value,
  valorPadrao,
  marcado,
  aoMudar,
  desabilitado,
}: {
  rotulo: string;
  dica?: string;
  name?: string;
  /** Valor enviado no formulário quando marcado (grupos com o mesmo `name`). Padrão do Radix: "on". */
  value?: string;
  valorPadrao?: boolean;
  marcado?: boolean;
  aoMudar?: (marcado: boolean) => void;
  desabilitado?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox
        name={name}
        value={value}
        defaultChecked={valorPadrao}
        checked={marcado}
        onCheckedChange={(v) => aoMudar?.(v === true)}
        disabled={desabilitado}
        className="mt-0.5"
      />
      <span className="flex flex-col">
        <span className="font-medium">{rotulo}</span>
        {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
      </span>
    </label>
  );
}
