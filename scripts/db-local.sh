#!/usr/bin/env bash
# Banco local (docker-compose.yml). Nunca toca o Supabase: as URLs são fixadas aqui.
#   scripts/db-local.sh recriar   → zera oem_dev, aplica migrações, seed base + dados da pasta rep
#   scripts/db-local.sh testar    → zera oem_test, aplica migrações, seed base e roda a suíte
set -euo pipefail
cd "$(dirname "$0")/.."

banco() {
  case "$1" in
    dev) echo oem_dev ;;
    test) echo oem_test ;;
  esac
}

zerar() {
  local nome
  nome="$(banco "$1")"
  docker compose up -d --wait db >/dev/null
  docker exec oem-representacoes-db psql -U oem -d postgres -qc "DROP DATABASE IF EXISTS $nome WITH (FORCE)" -c "CREATE DATABASE $nome OWNER oem"
  export DATABASE_URL="postgresql://oem:oem@localhost:54329/$nome"
  export DIRECT_URL="$DATABASE_URL"
  npx prisma migrate deploy >/dev/null
  npx tsx prisma/seed.ts
}

case "${1:-}" in
  recriar)
    zerar dev
    npx tsx prisma/seed-rep.ts
    ;;
  testar)
    zerar test
    shift
    npx vitest run "$@"
    ;;
  *)
    echo "uso: scripts/db-local.sh recriar|testar" >&2
    exit 1
    ;;
esac
