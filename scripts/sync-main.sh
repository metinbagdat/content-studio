#!/usr/bin/env bash
# Safe pull of origin/main when package-lock.json blocks checkout.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> content-studio sync-main"

if git diff --quiet package-lock.json 2>/dev/null; then
  echo "package-lock.json: clean"
else
  echo "package-lock.json: local changes — discarding (npm will regenerate)"
  git checkout -- package-lock.json || git stash push -m "sync-main-lock" -- package-lock.json
fi

git fetch origin
git checkout main
git pull origin main

echo "==> HEAD: $(git log -1 --oneline)"
echo "==> next in package.json: $(node -p "require('./package.json').dependencies.next")"

rm -rf node_modules
npm install

echo "==> npm audit"
npm audit || true

echo ""
echo "OK. Start dev server:"
echo "  npm run dev"
echo "Expect: Next.js 15.5.22 and ~90 packages audited"
