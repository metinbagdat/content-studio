#!/usr/bin/env bash
# Force sync to origin/main when package-lock.json blocks checkout/merge.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> content-studio sync-main (hard reset to origin/main)"

git fetch origin

echo "==> Dropping local package-lock.json changes..."
git restore --staged package-lock.json 2>/dev/null || true
git restore package-lock.json 2>/dev/null || true
git checkout -- package-lock.json 2>/dev/null || true
rm -f package-lock.json

echo "==> Switching to main and matching origin exactly..."
git checkout -f main 2>/dev/null || git checkout main
git reset --hard origin/main

echo "==> HEAD: $(git log -1 --oneline)"
echo "==> next: $(node -p "require('./package.json').dependencies.next")"

rm -rf node_modules
npm install

echo "==> npm audit"
npm audit || true

echo ""
echo "OK. Run: npm run dev"
echo "Expect terminal: Next.js 15.5.22"
