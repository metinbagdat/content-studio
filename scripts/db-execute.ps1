# Safe, targeted SQL execution against the REAL database (.env.local's DATABASE_URL),
# bypassing `prisma db push`'s full-schema diff (which can prompt to drop unrelated
# tables like a leftover `users` table from the legacy app).
#
# RECOMMENDED usage - write SQL to a file with a here-string first (no quoting problems
# at all), then pass the file. Run this directly in PowerShell, NOT via "npm run db:exec --"
# (npm invokes scripts through cmd.exe on Windows, which mangles single quotes and breaks
# -Sql inline strings):
#
#   @'
#   ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'NEW_VALUE';
#   '@ | Out-File -Encoding ascii change.sql
#   .\scripts\db-execute.ps1 -File .\change.sql
#   Remove-Item change.sql
#
# -Sql inline also works, but ONLY when you call this script directly (not through npm):
#   .\scripts\db-execute.ps1 -Sql 'ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS ''NEW_VALUE'';'
#
# Why this exists (2026-08): `prisma db push` compares the ENTIRE live schema against
# packages/db/prisma/schema.prisma and will offer to DROP any table it doesn't recognize (e.g. an
# old `users` table from the quarantined legacy app). Never accept that prompt blindly.
# Small additive changes (new enum value, new column with default, new index) should go
# through this script instead - one targeted statement, no destructive diff.

param(
  [string]$Sql,
  [string]$File
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not $Sql -and -not $File) {
  Write-Host "Usage: db-execute.ps1 -Sql '<statement>'  OR  -File <path.sql>" -ForegroundColor Yellow
  exit 1
}

# Prisma CLI reads .env by default; this project's real DB lives in .env.local - override for this run only.
$envLocalLine = Get-Content .env.local -ErrorAction SilentlyContinue | Select-String '^DATABASE_URL='
if (-not $envLocalLine) {
  Write-Host "DATABASE_URL not found in .env.local - falling back to .env" -ForegroundColor Yellow
} else {
  $env:DATABASE_URL = ($envLocalLine.ToString() -replace '^DATABASE_URL=', '').Trim('"')
}

$tempFile = $null
try {
  if ($Sql) {
    $tempFile = Join-Path $env:TEMP "cs-db-execute-$([guid]::NewGuid()).sql"
    # ASCII avoids the UTF-8 BOM that Out-File -Encoding utf8 adds (breaks Postgres parsing).
    $Sql | Out-File -Encoding ascii -FilePath $tempFile
    $targetFile = $tempFile
  } else {
    $targetFile = $File
  }

  $maskedUrl = $env:DATABASE_URL -replace '://[^@]+@', '://***@'
  Write-Host "==> Executing against: $maskedUrl" -ForegroundColor Cyan
  npx prisma db execute --file $targetFile --schema .\packages\db\prisma\schema.prisma
  Write-Host "==> Done." -ForegroundColor Green
} finally {
  if ($tempFile -and (Test-Path $tempFile)) { Remove-Item $tempFile }
}
