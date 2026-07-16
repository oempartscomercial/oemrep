# ADR-011 — Untitled UI React (OSS/MIT) como design system oficial

**Data:** 2026-07-15 · **Status:** Aceito · Substitui shadcn/ui como fonte visual

## Contexto
Até o Épico 5 a aplicação usava **shadcn/ui** (estilo `base-nova`) sobre
**`@base-ui/react`**, com um tema 100% em escala de cinza (sem cor de marca). O cliente
decidiu adotar o **Untitled UI React Open Source** (https://github.com/untitleduico/react,
licença **MIT**) como fonte única e obrigatória de linguagem visual: tokens, tipografia,
cores, espaçamento, radius, sombras, componentes, variantes, estados, formulários,
tabelas, navegação, layouts, composição de páginas, responsividade e acessibilidade.

## Decisão
1. **Untitled UI OSS passa a ser a fonte visual única.** shadcn/ui deixa de ser a base
   visual. Componentes shadcn podem coexistir apenas durante a migração e são
   substituídos por equivalentes do Untitled UI ou reestilizados 100% pelos tokens do
   Untitled UI quando não há equivalente. **Proibido misturar** o default do shadcn com
   o Untitled UI, ou combinar Origin UI / ReUI / Tremor / Mantine etc.
2. **Somente componentes gratuitos (MIT).** Nada de Pro, templates pagos ou Figma pago.
   O código real vem via CLI oficial `npx untitledui@latest add [componente]`.
3. **Stack mantida (sem upgrade estrutural).** React 19, Next 16, TypeScript strict,
   Tailwind v4 já são compatíveis com o Untitled UI OSS (Tailwind v4.3 / React 19.2 /
   TS 5.9). Adiciona-se `react-aria-components`, `@untitledui/icons`,
   `tailwindcss-react-aria-components` e `tailwindcss-animate`. Remove-se `@base-ui/react`
   e `shadcn` ao fim da migração.
4. **Base UI → React Aria.** O Untitled UI é construído sobre **React Aria**. Como o
   projeto usa **Base UI** (não Radix), não há conflito Radix×React Aria; a troca é
   Base UI (sai) por React Aria (entra), controlada componente a componente.
5. **Identidade visual extraída da logo** (OEM Parts — círculo preto, engrenagem
   vermelha, tipografia branca):
   - **Primária = grafite/preto** (botões, navegação, ações).
   - **Destaque/marca = vermelho** (logo, estado ativo, links, alertas).
   - **Fundo = branco. Apenas tema claro** (dark mode fica fora de escopo).
   Como a primária é grafite, o vermelho permanece livre e semanticamente coerente para
   os muitos estados de alerta do domínio (divergência, extraviado, chamado crítico).
6. **Estrutura de pastas oficial** sob `src/components/`: `ui/` (base), `application/`
   (UI de aplicação), `patterns/` (composições recorrentes do produto) e `layouts/`.
7. **TDD adaptado à natureza visual.** A regra de ouro do projeto é TDD. Como a maior
   parte desta migração é apresentacional (onde "teste que falha antes" não se aplica),
   fica decidido: (a) manter **toda a suíte atual verde** como rede de regressão;
   (b) fazer **TDD real** nos trechos com lógica pura (ex.: mapeamento estado→cor/rótulo
   de `StatusBadge`); (c) ajustar seletores dos testes e2e que quebrarem com a nova
   estrutura de DOM. Nenhuma regra de negócio, rota, API, permissão (ADR-009), máquina
   de estado ou auditoria é alterada — a mudança é **só da camada visual**.

## Por quê
- Uma linguagem visual única, profissional e acessível, substituindo o cinza genérico
  atual, com identidade da OEM (grafite + vermelho).
- Untitled UI OSS é MIT, tecnicamente compatível com a stack e traz tokens/componentes
  prontos e consistentes — código real, não "inspiração".
- Manter grafite como primária evita "mar de vermelho" e preserva o vermelho para a
  semântica de alerta que o domínio já exige.

## Consequência
- `src/components/ui/*` (shadcn) é substituído; `@base-ui/react` e `shadcn` saem do
  `package.json`.
- `globals.css` passa a importar `theme.css` do Untitled UI (tokens de marca extraídos
  da logo); blocos de dark mode removidos.
- Ícones padronizados em `@untitledui/icons`.
- Nova rota `/design-system` (catálogo) e `DESIGN_SYSTEM.md` documentam o sistema.
- Testes e2e podem exigir ajuste de seletores; a suíte precisa voltar a ficar verde
  antes de considerar a migração concluída.
