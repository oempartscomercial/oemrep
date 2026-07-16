"use client";

import { useRouter } from "next/navigation";
import { RouterProvider } from "react-aria-components";

declare module "react-aria-components" {
    interface RouterConfig {
        routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
    }
}

/**
 * Integra a navegação do React Aria (links dos componentes) ao router do Next.
 */
export function RouteProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}
