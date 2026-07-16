import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Componentes/utilitários VENDORED do Untitled UI (código MIT copiado verbatim via
    // `npx untitledui add`). Mantemos o estilo do upstream — não é nosso código de
    // aplicação. As regras abaixo refletem padrões do próprio Untitled UI. O código do
    // produto (app/, components/{patterns,layouts}, domain/, lib/) segue o lint estrito.
    files: [
      "src/components/ui/**",
      "src/components/application/**",
      "src/components/foundations/**",
      "src/components/shared-assets/**",
      "src/hooks/**",
      "src/utils/cx.ts",
    ],
    rules: {
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
]);

export default eslintConfig;
