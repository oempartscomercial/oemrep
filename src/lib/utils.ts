import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// `cn` legado (clsx + twMerge) usado pelas telas ainda não migradas.
// Componentes novos do Untitled UI usam `cx`/`sortCx` de `@/utils/cx`.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
