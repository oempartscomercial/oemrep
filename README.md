# Plataforma de Representação Comercial

Sistema web que substitui as planilhas Excel de acompanhamento de **pedidos × notas
fiscais**, multi-fábrica (Bowden, Autoflex e futuras), com chamados de divergência,
rastreio e auditoria de tudo.

> 👤 **Este guia é para você, que não é programador.** Você toca o desenvolvimento
> **conversando com o agente** (Claude Code). Você não precisa ler nem escrever código.

---

## 🚦 Antes de começar (uma vez só)

1. **Instalar o Node.js** — é um programa gratuito que faz o sistema rodar.
   Baixe a versão **LTS** em https://nodejs.org e instale (Avançar → Avançar).
   *O agente te avisa quando isso for necessário e confere se deu certo.*
2. **Criar conta na Supabase** (gratuita) em https://supabase.com — é onde ficam os
   dados e o login. Crie um "projeto novo". O agente te diz quais 3 chaves copiar.

Não sabe fazer algum desses passos? **Peça ao agente:** *"me guia para instalar o Node"*.

## ▶️ Como tocar no dia a dia

### Iniciar uma sessão de trabalho
Abra o Claude Code nesta pasta e diga, por exemplo:
- **"Vamos começar o Épico 1."** (a primeira etapa)
- **"Continua de onde paramos."**
- **"O que falta para terminar o MVP?"**

O agente já lê o `CLAUDE.md` sozinho e sabe como trabalhar aqui.

### Aprovar um checkpoint
A cada tarefa, o agente explica o resultado **sem jargão** e pergunta se pode seguir.
Ex.: *"Isto cria a tela de login — você consegue abrir o site e entrar com e-mail e
senha. Pode seguir?"*
- Está bom? Responda **"pode seguir"**.
- Estranho? Diga o que viu de errado: *"o botão não funciona"*, *"não consigo entrar"*.

### Pedir a próxima tarefa
- **"Próxima tarefa."** / **"Pode continuar."**
- **"Antes, me mostra o que mudou."** (o agente resume em português)

### Ver o sistema rodando
Peça: **"roda o sistema para eu ver."** O agente sobe o site (geralmente em
`http://localhost:3000`) e te diz o que abrir no navegador.

## 🆘 Como saber se algo deu errado

- O agente **sempre roda os testes** e te avisa se algo quebrou (verde = ok,
  vermelho = problema). Há um **hook** configurado que confere os testes ao final.
- Se aparecer erro, diga: **"deu erro, resolve isso"** — o agente investiga de forma
  sistemática (não sai chutando).
- Você **nunca** precisa entender a mensagem técnica. Cole-a para o agente se quiser.

## 🗂️ O que tem em cada pasta (resumo)

| Pasta | É o quê | Você mexe? |
|---|---|---|
| `docs/` | PRD, design e decisões (ADRs) | Só leitura |
| `plans/` | Lista de tarefas (o roteiro) | Só leitura |
| `src/` | O código do sistema | **Nunca à mão** — peça ao agente |
| `.claude/` | Ajudantes do agente (subagentes + hook) | Não precisa mexer |
| `.env` | Senhas/chaves secretas | Só colar quando o agente pedir |

## 📍 Em que pé está o projeto

- ✅ Decisões fechadas, design e plano aprovados.
- ⏭️ **Agora:** executar o **Épico 1 — Fundação** (`plans/2026-06-22-epic-01-fundacao.md`).
- 🔜 Depois: Cadastros → Pedidos → Conferência de NFe → Rastreio → Divergências →
  Análise/Alertas/Auditoria. (ver `plans/README.md`)

## ⚠️ Observação sobre o OneDrive

Esta pasta está dentro do OneDrive. Quando o código começar, o agente vai criar uma
pasta `node_modules` (muito grande e que **não deve** ser sincronizada). O `.gitignore`
já a ignora no Git; se o OneDrive ficar lento, peça ao agente para orientar a excluir
`node_modules` da sincronização.

---

*Projeto conduzido com a metodologia **Superpowers** (skills + subagentes + TDD).
Detalhes de como o agente trabalha aqui: veja `CLAUDE.md`.*
