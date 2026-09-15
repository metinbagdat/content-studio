#!/usr/bin/env bash
# Cloud Agent install phase for Content Studio.
# Idempotent: safe to run repeatedly and against a warm snapshot.
# Prepares env files, Node dependencies, the local Postgres role/db, and
# reconciles the Prisma schema (handles the committed-migration enum drift).
set -euo pipefail

cd "$(dirname "$0")/.."

DB_URL='postgresql://content:content@127.0.0.1:5432/content_studio?schema=public'

# 1. Env files (git-ignored) — create from example, pin local DATABASE_URL.
for f in .env .env.local; do
  [ -f "$f" ] || cp .env.example "$f"
  if grep -q '^DATABASE_URL=' "$f"; then
    sed -i "s#^DATABASE_URL=.*#DATABASE_URL=\"${DB_URL}\"#" "$f"
  else
    printf '\nDATABASE_URL="%s"\n' "$DB_URL" >> "$f"
  fi
done

# 2. Node dependencies (postinstall runs `prisma generate`).
npm install

# 3. Ensure the local Postgres cluster is up so we can reconcile the schema.
sudo pg_ctlcluster 16 main start || true
for _ in $(seq 1 30); do
  pg_isready -h 127.0.0.1 -p 5432 -U content >/dev/null 2>&1 && break
  sleep 1
done

# 4. Ensure role + database exist (idempotent).
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='content'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE content WITH LOGIN PASSWORD 'content' CREATEDB;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='content_studio'" | grep -q 1 \
  || sudo -u postgres createdb -O content content_studio

# 5. Reconcile schema. `db push` avoids the committed migration's ContentType
#    enum drift (missing TWITTER_THREAD / LINKEDIN_CAROUSEL / SHORT_VIDEO_SCRIPT).
npx prisma db push --skip-generate

echo "cloud-agent-install: done"
