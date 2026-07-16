# DESIGN_SYSTEM.md — OEM Representações

Design system oficial do produto: **Untitled UI React Open Source (MIT)**.
Fonte de verdade da decisão: [`docs/adr/ADR-011`](docs/adr/ADR-011-design-system-untitled-ui.md).
Catálogo vivo (componentes e tokens reais): rota **`/design-system`**.

> Substitui o shadcn/ui. **Não** misture shadcn default, Origin UI, ReUI, Tremor, Mantine
> ou qualquer outra biblioteca visual. Uma única linguagem visual.

## Identidade

Extraída da logo "OEM Parts" (círculo preto, engrenagem vermelha, tipografia branca):

- **Primária = grafite** (botões, navegação, foco, estado ativo).
- **Vermelho = destaque/marca** (logo) e **semântica de alerta** (divergência, extraviado,
  chamado crítico, erros, ações destrutivas).
- **Fundo branco. Apenas tema claro** (dark mode fora de escopo).
- Tipografia **Inter**.

## Tokens

Definidos em `src/styles/theme.css` (bloco `@theme` do Tailwind v4) e tipografia em
`src/styles/typography.css`; importados por `src/app/globals.css`.

- **Cores primitivas:** `--color-brand-*` (grafite, 50→950), `--color-red-*` (vermelho OEM),
  `--color-neutral-*`, `--color-green/yellow/blue-*`.
- **Tokens semânticos** (use SEMPRE estes nas telas, não os primitivos):
  - Texto: `text-primary`, `text-secondary`, `text-tertiary`, `text-error-primary`, `text-brand-secondary`.
  - Superfície/fundo: `bg-primary`, `bg-secondary`, `bg-brand-solid` (botão primário).
  - Bordas: `border-secondary`, `border-primary`.
  - Ícones/fg: `text-fg-brand-primary`, `text-fg-error-primary`.
- **Tipografia:** `text-xs…text-xl`, `text-display-xs…text-display-2xl`.
- **Radius:** `rounded-sm…rounded-3xl`. **Sombras:** `shadow-xs…shadow-3xl`.

Rebrand: a cor da marca vive em `--color-brand-*` (grafite). Para trocar a marca, edite
apenas esse bloco no `theme.css`.

## Estrutura de pastas

```
src/components/
├── ui/            # componentes base do Untitled UI (buttons/, input/, select/, badges/, checkbox/…)
├── application/   # UI de aplicação (table/, tabs/, modals/, pagination/, file-upload/, app-navigation/)
├── patterns/      # composições recorrentes do produto (abaixo)
├── layouts/       # AppShell, AuthLayout, PageContainer
└── foundations/   # apoio interno do Untitled (featured-icon/, logo/oem-logo)
src/utils/cx.ts    # helper cx()/sortCx() (igual ao upstream)
src/hooks/         # use-breakpoint, use-resize-observer, use-clipboard
src/providers/     # RouteProvider (integra React Aria ao router do Next)
```

### Patterns do produto (`src/components/patterns/`)
- **`StatusBadge`** + `statusBadgeConfig` (lógica pura, com testes) — estado do domínio
  (Pedido/NFe/Chamado) → cor + rótulo.
- **`PageHeader`** — título, descrição, ações.
- **`DataTable`** — envolve a Table (React Aria) numa API de `columns` + `data` (+ `rowHref`).
- **`FormField`** — rótulo + controle + erro/ajuda.
- **`FiltrosBar`** — barra de filtros das listas.
- **`Timeline`** — histórico de eventos (rastreio).

## Convenções

- **Imports:** componentes em `@/components/...`; helper em `@/utils/cx` (`cx`, `sortCx`);
  ícones em `@untitledui/icons`. (Manter `@/utils/cx` = upstream faz `npx untitledui add`/
  `upgrade` funcionarem sem reescrever imports.)
- **Server × Client:** páginas que buscam dados (Prisma) são server components e passam
  **dados serializáveis** para componentes-tabela **client** (o `DataTable` usa funções
  `render`, que não cruzam a fronteira). Ex.: `pedidos-tabela.tsx`, `cadastros-tabelas.tsx`.
- **Formulários com server action + FormData:** os componentes React Aria (`Input`,
  `Select`, `Checkbox`) preservam `name`/`value` no envio. Em selects com valor padrão,
  use `defaultSelectedKey`.
- **Acessibilidade:** herdada do React Aria; sempre passe `aria-label` em tabelas/controles
  sem rótulo visível.

## Como adicionar / atualizar componentes

```bash
# adicionar um componente OSS (MIT) do Untitled UI
npx untitledui@latest add <componente>

# atualizar para a última versão
npx untitledui@latest add <componente> --overwrite
```

Depois de trazer, ajuste imports para os aliases do projeto (`@/components/ui/...`,
`@/utils/cx`). **Somente componentes gratuitos/MIT** — nada de Pro/Figma pago.

## Verificação

Sem banco de dados no ambiente de dev local, use:
`npx vitest run src/domain` + `npx tsc --noEmit` + `npm run build` + verificação visual no
navegador (`/design-system` e `/login` renderizam sem banco). Ver
[`plans/2026-07-15-untitled-ui-design-system.md`](docs/superpowers/plans/2026-07-15-untitled-ui-design-system.md).
