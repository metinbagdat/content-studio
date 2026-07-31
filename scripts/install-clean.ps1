# Clean install on Windows — run from repo root in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts/install-clean.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> content-studio clean install" -ForegroundColor Cyan
Write-Host "Do NOT press Ctrl+C until finished (Prisma postinstall can take 1-3 min)." -ForegroundColor Yellow

if (Test-Path node_modules) {
  Write-Host "Removing node_modules..."
  Remove-Item -Recurse -Force node_modules
}

Write-Host "npm install (wait for completion)..."
npm install

Write-Host "Prisma generate..."
npx prisma generate

Write-Host "npm audit (informational only — do NOT run npm audit fix --force):"
npm audit

$nextPkg = Get-Content node_modules\next\package.json -Raw | ConvertFrom-Json
Write-Host "Installed next: $($nextPkg.version)" -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Green
