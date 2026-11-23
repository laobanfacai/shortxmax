#!/usr/bin/env bash
# Local / VPS helper: generate client, push schema, seed if empty, start production server.
set -euo pipefail
cd "$(dirname "$0")/.."
export PORT="${PORT:-3100}"
export HOST="${HOST:-0.0.0.0}"

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example first."
  exit 1
fi

npx prisma generate
npx prisma db push
if [ ! -f prisma/dev.db ] || [ ! -s prisma/dev.db ]; then
  npm run db:seed
fi

# Seed anyway if no users exist? leave manual.

if [ "${1:-}" = "dev" ]; then
  exec npm run dev
fi

npm run build
exec npm start
