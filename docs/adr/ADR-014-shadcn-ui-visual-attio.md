# ADR-014 — shadcn/ui como base visual, com direção tipo Attio

**Data:** 2026-10-06 · **Status:** Aceito · Substitui o [ADR-011](ADR-011-design-system-untitled-ui.md)

## Contexto
O Untitled UI deu à plataforma uma cara de template genérico. O Arthur quer, antes do
módulo de CRM (ADR-013), uma interface enxuta e densa no estilo do Attio: cinzas
neutros com cor só em detalhe, bordas finas, cantos pequenos, texto de 13–14px, tabelas
como planilha, menu lateral compacto, ficha com coluna de atributos e paleta de comandos
(⌘K). UX é a maior preocupação do projeto.

## Decisão
1. **shadcn/ui passa a ser a base de componentes** (copiados para `src/components/ui`),
   sobre Radix, com Tailwind v4 e `lucide-react` nos ícones.
2. **A direção visual é a do Attio**, definida nos tokens do tema (`globals.css`), não em
   cada tela: densidade, raio pequeno, cinza neutro, vermelho da OEM só como destaque e
   para alertas.
3. **Troca completa, sem convivência.** No Untitled UI `bg-primary` é o fundo; no shadcn é
   a cor da marca. Os dois não coexistem na mesma árvore. O Untitled UI sai por inteiro
   (`@untitledui/*`, `react-aria-components`, `tailwindcss-react-aria-components`).
4. **Nenhuma regra de negócio, rota, API, permissão ou auditoria muda.** A suíte de testes
   é a rede de regressão. A página `/design-system` é refeita no novo padrão.
5. Só tema claro.

## Consequência
- ~37 arquivos de tela e todos os componentes de `src/components/{ui,application,patterns,layouts}`
  são migrados. O CRM (Fase 2) nasce já neste padrão.
- `DESIGN_SYSTEM.md` e o `CLAUDE.md` passam a apontar para este ADR.
