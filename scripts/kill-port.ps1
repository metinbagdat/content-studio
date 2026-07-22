param(
  [int]$Port = 3100
)

$ErrorActionPreference = 'SilentlyContinue'
$pids = Get-NetTCPConnection -LocalPort $Port -State Listen | Select-Object -ExpandProperty OwningProcess -Unique

if (-not $pids) {
  Write-Host "Port $Port is free."
  exit 0
}

foreach ($procId in $pids) {
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
  Write-Host "Stopping $name (PID $procId) on port $Port..."
  Stop-Process -Id $procId -Force
}

Start-Sleep -Seconds 1
$still = Get-NetTCPConnection -LocalPort $Port -State Listen
if ($still) {
  Write-Host "Port $Port still in use - run as Admin or close background terminals."
  exit 1
}

Write-Host "Port $Port is free."
