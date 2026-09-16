#!/usr/bin/env bash
# Cloud Agent per-boot start phase for Content Studio.
# Brings up the local Postgres daemon (install/snapshot already created the
# cluster, role, db, and schema). Idempotent and returns once ready.
set -euo pipefail

sudo pg_ctlcluster 16 main start || true

for _ in $(seq 1 30); do
  pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && { echo "postgres ready"; exit 0; }
  sleep 1
done

echo "postgres did not become ready in time" >&2
exit 1
