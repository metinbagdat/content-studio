# Content Studio local DB setup (Windows)
# Prerequisite: WSL2 + Ubuntu, then Docker Desktop running.
# You do NOT need Docker Hub repositories for this.

Write-Host "== WSL check ==" -ForegroundColor Cyan
wsl -l -v
if ($LASTEXITCODE -ne 0) {
  Write-Host "No WSL distro. Open Admin PowerShell and run:" -ForegroundColor Yellow
  Write-Host '  wsl --install -d Ubuntu'
  Write-Host "Then reboot, open Ubuntu once, start Docker Desktop, re-run this script."
  exit 1
}

Write-Host "== Docker engine ==" -ForegroundColor Cyan
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Starting Docker Desktop..."
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 5
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Write-Host "  waiting for engine... $($i+1)/30"
  }
  if (-not $ok) {
    Write-Host "Docker engine still down. Fix WSL/Docker Desktop first." -ForegroundColor Red
    exit 1
  }
}

Set-Location $PSScriptRoot\..
Write-Host "== compose up ==" -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== prisma migrate ==" -ForegroundColor Cyan
npx prisma migrate deploy
npx prisma generate
docker compose ps
Write-Host "Done. Run: npm run dev  (http://localhost:3100/admin)" -ForegroundColor Green
