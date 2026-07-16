import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            text: ["display-xs", "display-sm", "display-md", "display-lg", "display-xl", "display-2xl"],
        },
    },
});

/**
 * Wrapper em torno do twMerge, usado para mesclar classes dentro de objetos de estilo.
 */
export const cx = twMerge;

/**
 * Não faz nada além de permitir ordenar as classes dentro de objetos de estilo
 * (o que o Tailwind IntelliSense não suporta por padrão).
 */
export function sortCx<T extends Record<string, unknown>>(classes: T): T {
    return classes;
}
