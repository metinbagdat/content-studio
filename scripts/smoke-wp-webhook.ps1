# WP publish webhook smoke test — reads secrets from .env.local (never prints values).
param(
  [string]$EnvFile = (Join-Path (Join-Path $PSScriptRoot '..') '.env.local'),
  [string]$PrimaryUrl = 'https://studio.egitim.today/api/webhooks/wordpress-published',
  [string]$AliasUrl = 'https://studio.egitim.today/api/wordpress/webhook',
  [int]$PostId = 999999088
)

function Get-EnvVal([string]$name) {
  (Get-Content $EnvFile | Where-Object { $_ -match "^$name=" }) -replace "^$name=", '' -replace '^"|"$', '' -replace "^'|'$", ''
}

$secret = Get-EnvVal 'WP_PUBLISH_WEBHOOK_SECRET'
$apiKey = Get-EnvVal 'CONNECT_STUDIO_API_KEY'

if (-not $secret -or $secret.Length -lt 32) { throw "WP_PUBLISH_WEBHOOK_SECRET missing in $EnvFile" }
if (-not $apiKey) { throw "CONNECT_STUDIO_API_KEY missing in $EnvFile" }

$payload = @{
  event     = 'content_published'
  post_id   = $PostId
  post_type = 'article'
  title     = 'curl smoke test'
  link      = 'https://blog.egitim.today/curl-smoke-test'
  content   = 'Automated webhook smoke test — delete via scripts/cleanup-wp-smoke.ts'
  meta      = @{
    cs_ai_generated           = 'yes'
    cs_safe_samurai_validated = 'yes'
  }
} | ConvertTo-Json -Depth 5 -Compress

function Invoke-Smoke([string]$label, [hashtable]$headers) {
  Write-Host "`n=== $label ==="
  try {
    $r = Invoke-WebRequest -Method POST -Uri $PrimaryUrl -ContentType 'application/json' -Headers $headers -Body $payload -SkipHttpErrorCheck
    Write-Host "HTTP $($r.StatusCode)"
    Write-Host $r.Content
  } catch {
    Write-Host "ERROR: $($_.Exception.Message)"
  }
}

Invoke-Smoke '1) No auth - expect 401' @{}
Invoke-Smoke '2) Wrong secret - expect 401' @{ 'x-wp-webhook-secret' = 'definitely-wrong' }
Invoke-Smoke '3) Legacy X-API-Key (current prod until redeploy)' @{ 'X-API-Key' = $apiKey }
Invoke-Smoke '4) Dedicated secret (after new code redeploy)' @{ 'x-wp-webhook-secret' = $secret }

Write-Host "`n=== 5) Alias path ==="
try {
  $r = Invoke-WebRequest -Method POST -Uri $AliasUrl -ContentType 'application/json' -Headers @{ 'x-wp-webhook-secret' = $secret } -Body $payload -SkipHttpErrorCheck
  Write-Host "HTTP $($r.StatusCode)"
  Write-Host $r.Content
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
}

Write-Host "`nCleanup: npx tsx scripts/cleanup-wp-smoke.ts (add $PostId to SMOKE_POST_IDS if used)"
