#!/bin/sh
# Disposable PostgreSQL 16 for the API tests. Data lives in tmpfs, so
# `down` (or a Docker restart) discards everything. Never points at a real DB.
#
#   npm run test:db:up     start the container and apply the committed migrations
#   npm run test:db:down   remove the container
set -eu

NAME=meraki-test-pg
PORT=${TEST_DB_PORT:-55432}
URL="postgresql://meraki:meraki@127.0.0.1:${PORT}/meraki_test"
cd "$(dirname "$0")/.."

case "${1:-}" in
  up)
    if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
      echo "Container $NAME already exists; run 'npm run test:db:down' first to start clean." >&2
    else
      docker run -d --name "$NAME" \
        -e POSTGRES_USER=meraki -e POSTGRES_PASSWORD=meraki -e POSTGRES_DB=meraki_test \
        -p "127.0.0.1:${PORT}:5432" --tmpfs /var/lib/postgresql/data \
        postgres:16-alpine >/dev/null
    fi
    printf 'Waiting for PostgreSQL'
    i=0
    until docker exec "$NAME" pg_isready -U meraki -d meraki_test -h 127.0.0.1 >/dev/null 2>&1; do
      i=$((i + 1)); [ "$i" -gt 60 ] && { echo " timed out" >&2; exit 1; }
      printf '.'; sleep 1
    done
    echo " ready"
    # Explicit env wins over backend/.env, so the dev database is never used.
    DATABASE_URL="$URL" DIRECT_URL="$URL" npx prisma migrate deploy
    echo "Test database: $URL"
    ;;
  down)
    docker rm -f "$NAME" >/dev/null 2>&1 && echo "Removed $NAME" || echo "$NAME was not running"
    ;;
  *)
    echo "usage: $0 up|down" >&2; exit 2
    ;;
esac
