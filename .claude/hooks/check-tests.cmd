@echo off
REM ---------------------------------------------------------------------------
REM Hook (Stop): roda a suite de testes ao final do turno do agente, para que o
REM dono leigo receba um sinal verde/vermelho sem precisar pedir.
REM
REM É GUARDADO e NÃO-BLOQUEANTE:
REM  - se o projeto ainda não foi montado (sem package.json) -> sai 0 em silêncio
REM  - se o Node não está instalado -> sai 0 em silêncio
REM  - sempre sai 0 (nunca bloqueia o agente); serve para informar, não impedir
REM
REM Para desativar: remova o bloco "Stop" de .claude/settings.json
REM ---------------------------------------------------------------------------

set "ROOT=%~dp0..\.."

if not exist "%ROOT%\package.json" exit /b 0
where node >nul 2>nul || exit /b 0

pushd "%ROOT%"
echo [hook] Rodando os testes (npm test)...
call npm test --silent
if errorlevel 1 (
  echo [hook] ATENCAO: ha testes vermelhos. Pessa ao agente: "os testes falharam, resolve isso".
) else (
  echo [hook] Testes verdes.
)
popd
exit /b 0
