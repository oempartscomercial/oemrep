# Spec — Migração para o design system Untitled UI React (OSS/MIT)

**Data:** 2026-07-15 · **ADR:** [ADR-011](../../adr/ADR-011-design-system-untitled-ui.md)
· **Ritmo:** autônomo com resumos visuais por bloco · **Tema:** só claro

## 1. Objetivo

Adotar o **Untitled UI React Open Source (MIT)** como fonte visual única e obrigatória,
substituindo o shadcn/ui. Migrar as **18 telas** existentes para a nova linguagem, sem
alterar regras de negócio, rotas, APIs, permissões (ADR-009), máquinas de estado ou
auditoria. A migração só é considerada concluída quando **nenhuma tela** ainda exibir a
linguagem visual anterior.

## 2. Identidade visual (extraída da logo OEM Parts)

Logo: círculo preto, engrenagem vermelha, tipografia branca.

| Papel | Cor | Uso |
|---|---|---|
| **Primária** | Grafite/preto (escala neutra 950≈`#0C0C0D`) | Botões primários, nav, ações |
| **Marca/Destaque** | Vermelho (core ≈ `#E23A2E`, escala 25→950) | Logo, estado ativo, links, alertas |
| **Fundo** | Branco | Superfícies |
| **Neutros** | Escala grafite (Untitled "Gray") | Texto, bordas, superfícies secundárias |
| Semânticos | success (verde), warning (âmbar), error (vermelho) | Estados |

- **Só tema claro.** Blocos `.dark` removidos.
- Como a primária é grafite, o vermelho fica reservado para marca + alertas (coerente
  com divergência/extraviado/crítico do domínio).
- Tipografia **Inter**; escala tipográfica, espaçamento, radius e sombras do Untitled UI.
- A escala exata de cores é fixada no `theme.css` na fase de Fundação; a logo é salva em
  `public/` (ex.: `public/oem-logo.png` / versão para fundo claro) para shell e login.

## 3. Compatibilidade técnica (verificada)

| Item | Untitled UI OSS | Projeto | Ação |
|---|---|---|---|
| Licença | MIT | — | usar só OSS |
| Tailwind | v4.3 | v4 | ok |
| React | 19.2 | 19.2.4 | ok |
| TypeScript | 5.9 | 5.x | ok |
| Acessibilidade | React Aria | Base UI | trocar (sem Radix ⇒ sem conflito) |
| Ícones | `@untitledui/icons` | `lucide-react` | padronizar em `@untitledui/icons` |

**Dependências a adicionar:** `react-aria-components`, `@untitledui/icons`,
`tailwindcss-react-aria-components`, `tailwindcss-animate` (mantém `tailwind-merge`,
`clsx`, `class-variance-authority` enquanto úteis).
**A remover ao fim:** `@base-ui/react`, `shadcn`, `tw-animate-css` (se substituído),
`lucide-react` (se totalmente migrado), e os componentes `src/components/ui/*` antigos.

## 4. Arquitetura de componentes

```
src/components/
├── ui/          # base Untitled UI (código MIT via CLI, imports adaptados p/ @/components)
├── application/ # UI de aplicação (sidebar, table header, paginação, empty state, dropdown)
├── patterns/    # composições recorrentes do produto
└── layouts/     # AppShell, AuthLayout, PageContainer
```

- Código real trazido com `npx untitledui@latest add [componente]`, com imports
  reescritos para `@/components/...` e `@/lib/utils` (helper `cx`/`cn`).
- Consistência interna preservada: não copiar o repositório inteiro; trazer só o
  necessário e suas dependências diretas.

### 4.1 Componentes base (`ui/`) — inventário mínimo (YAGNI)
Derivado do uso atual (`card`×10, `button`×8, `table`×6, `input`×5, `badge`×5,
`label`×3, `tabs`×1) + necessidades das telas:
Button, Input, Textarea, Label, Select, Checkbox, Badge, Card (superfície),
Table (+ header/row/cell), Tabs, Modal/Dialog, Tooltip, Dropdown/Menu, Pagination,
FileUpload (importação de planilha/XML).

### 4.2 Patterns (`patterns/`)
- **PageHeader** — título, descrição, ações (ex.: "Novo pedido").
- **StatusBadge** — mapeia estados do domínio → cor/rótulo. **Lógica pura ⇒ TDD.**
  Cobre Pedido (`SEM_NFE|PARCIAL|COMPLETO|ARQUIVADO`), NFe/Rastreio
  (`TRANSITO|RECEBIDA|ARMAZENADA|EXTRAVIADO`) e Chamado.
- **DataTable** — wrapper sobre Table (cabeçalho, vazio, densidade) reutilizado nas listas.
- **FormField** — Label + control + mensagem de erro/ajuda (usado nos formulários).
- **FiltrosBar** — barra de filtros das listas (ex.: situação do pedido).
- **Timeline** — linha do tempo de eventos (rastreio: `EventoRastreio`).
- **EmptyState** — estado vazio das listas.

### 4.3 Layouts (`layouts/`)
- **AppShell** — sidebar (nav do Untitled UI) + área de conteúdo; substitui
  `NavLateral.tsx` + `(app)/layout.tsx`. Responsivo (sidebar colapsável no mobile).
- **AuthLayout** — moldura da tela de login.
- **PageContainer** — largura/respiros padrão das páginas.

## 5. Ordem de migração (blocos = commits pequenos)

1. **Fundação:** deps, `theme.css` (paleta da logo) + `globals.css`, fonte Inter, helper
   `cx`, scaffold de pastas, logo em `public/`.
2. **Base (`ui/`)** + **patterns/layouts** fundamentais.
3. **Shell:** `AppShell` + nav → `(app)/layout.tsx`.
4. **Telas:** login → dashboard (`(app)/page.tsx`) → pedidos (lista/novo/importar/
   detalhe) → conferência (lista/detalhe) → cadastros (fábricas/clientes/usuários +
   forms) → rastreio (lista/detalhe).
5. **Limpeza:** remover Base UI/shadcn/ui antigos e deps órfãs; padronizar ícones.
6. **Catálogo:** rota `/design-system` com os componentes e tokens reais.
7. **Docs:** `DESIGN_SYSTEM.md`.
8. **Validação:** visual desktop/tablet/mobile + `tsc`, lint, `npm test`, `npm run e2e`,
   `npm run build` verdes.

## 6. Preservação de comportamento (invariáveis)

Rotas, APIs (`src/app/api/*`), acesso a dados (`src/lib`, Prisma), domínio
(`src/domain/*`), permissões por fábrica (ADR-009), máquinas de estado, snapshot de
pendência (ADR-008) e auditoria **não mudam**. Só troca a camada de apresentação
(`src/app/**/page.tsx`, `layout.tsx`, `src/components/*`).

## 7. Estratégia de testes

- **Regressão:** `src/domain/**` e demais testes de unidade/integração permanecem verdes
  sem alteração de lógica.
- **TDD real** onde há lógica pura: `patterns/StatusBadge` (estado→cor/rótulo) e qualquer
  helper de apresentação com ramificação.
- **e2e (Playwright):** rodar após cada bloco de telas; ajustar seletores que dependam de
  estrutura de DOM alterada, preferindo seletores por *role*/texto acessível (React Aria
  entrega bons roles). Suíte precisa ficar verde antes do "done".

## 8. Definition of Done

- Todas as 18 telas na linguagem Untitled UI (nenhuma com aparência shadcn/cinza antiga).
- `@base-ui/react` e `shadcn` removidos; sem mistura de bibliotecas.
- Rota `/design-system` publicada com catálogo real; `DESIGN_SYSTEM.md` escrito.
- Responsivo validado em desktop/tablet/mobile (só tema claro).
- `tsc` + lint + `npm test` + `npm run e2e` + `npm run build` verdes.
- ADR-011 e este spec refletindo o resultado.

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| e2e quebra por mudança de DOM | Rodar por bloco; seletores por role/texto; ajustar cedo |
| CLI `untitledui init` sobrescrever arquivos | Não usar `init` destrutivo; usar `add` e reconciliar `theme.css`/`globals.css` à mão |
| Divergência de tokens (shadcn ↔ Untitled) | Substituir tokens de uma vez na Fundação; não deixar telas meio-migradas em produção-visual |
| Ícones misturados (lucide × untitled) | Padronizar em `@untitledui/icons`; remover lucide ao fim |
| "Mar de vermelho" | Primária grafite; vermelho só marca/alerta |
