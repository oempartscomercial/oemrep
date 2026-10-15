import { iniciais } from "@/domain/formato/nome";
import { cn } from "@/lib/utils";

// Tons do avatar: a cor só ajuda a reconhecer a empresa de relance; não carrega significado.
const TONS = [
  "bg-[oklch(0.93_0.04_255)] text-[oklch(0.38_0.12_255)]",
  "bg-[oklch(0.93_0.045_175)] text-[oklch(0.38_0.08_175)]",
  "bg-[oklch(0.93_0.04_300)] text-[oklch(0.4_0.12_300)]",
  "bg-[oklch(0.94_0.05_80)] text-[oklch(0.42_0.1_65)]",
  "bg-[oklch(0.93_0.04_10)] text-[oklch(0.42_0.13_15)]",
  "bg-[oklch(0.93_0.05_140)] text-[oklch(0.38_0.1_145)]",
];

function tom(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONS[h % TONS.length];
}

const TAMANHO = { xs: "size-5 text-[10px] rounded", sm: "size-7 text-xs rounded-md", md: "size-9 text-sm rounded-lg", lg: "size-12 text-lg rounded-xl md:size-14 md:text-xl" } as const;

/** Quadrado com as iniciais da empresa. */
export function AvatarEmpresa({ nome, tamanho = "md", className }: { nome: string; tamanho?: keyof typeof TAMANHO; className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center font-semibold tracking-tight select-none", TAMANHO[tamanho], tom(nome), className)}>
      {iniciais(nome)}
    </span>
  );
}

/** Bolinha com as iniciais de uma pessoa (responsável, autor). */
export function AvatarPessoa({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      aria-hidden
      title={nome}
      className={cn("grid size-5 shrink-0 place-items-center rounded-full bg-foreground/85 text-[10px] font-semibold text-background select-none", className)}
    >
      {iniciais(nome)}
    </span>
  );
}
