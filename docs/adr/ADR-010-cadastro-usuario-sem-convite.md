# ADR-010 — Cadastro de usuário sem convite por e-mail (vínculo no 1º acesso)

**Data:** 2026-06-28 · **Status:** Aceito · Refina ADR-009 · Resolve a Task 8 do Épico 2

## Contexto
O plano do Épico 2 (Task 8) previa criar usuários disparando um **convite por e-mail**
via `auth.admin.inviteUserByEmail`, o que exige guardar a `service_role key` do
Supabase no servidor e enviar e-mails reais. O dono optou por uma **versão mais simples**
para o MVP, sem manusear segredo de admin nem enviar e-mails.

## Decisão
1. A tela de Usuários **cria apenas o registro de domínio** (`Usuario`: nome, e-mail,
   perfil e fábricas autorizadas). **Não** cria a credencial de login.
2. O **login da pessoa é criado pelo ADMIN no painel do Supabase** (Authentication →
   Users), usando o **mesmo e-mail** do cadastro.
3. O campo `Usuario.supabaseUserId` passa a ser **opcional**. No **primeiro acesso** da
   pessoa, `obterUsuarioLogado()` casa o login ao cadastro **pelo e-mail** e grava o
   `supabaseUserId` (vínculo definitivo para os acessos seguintes).

## Consequência
- Não precisamos da `service_role key` nem de envio de e-mail no MVP (menos segredo,
  menos superfície de risco).
- O e-mail do cadastro **precisa ser idêntico** ao e-mail do login Supabase, senão o
  vínculo no 1º acesso não acontece.
- O **convite automático por e-mail** fica como melhoria pós-MVP (reabrir esta decisão
  quando a equipe crescer). Mantém-se tudo do [ADR-009] (perfis + permissão por fábrica).
