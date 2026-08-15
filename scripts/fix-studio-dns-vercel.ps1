# studio.egitim.today: TikTok TXT sil → CNAME ekle (CNAME+TXT ayni isimde olamaz)
# Kullanim:
#   $env:VERCEL_TOKEN = "..."   # vercel.com/account/tokens
#   $env:VERCEL_TEAM_ID = "team_N4H4fEI4NH7mO7l4hLDKBX03"  # opsiyonel
#   powershell -ExecutionPolicy Bypass -File scripts/fix-studio-dns-vercel.ps1

$ErrorActionPreference = "Stop"
$token = $env:VERCEL_TOKEN
if (-not $token) {
  Write-Host "VERCEL_TOKEN eksik. vercel.com/account/tokens -> Read/Write -> token olusturun."
  Write-Host ""
  Write-Host "Manuel (Vercel -> egitim.today -> DNS Records):"
  Write-Host "  1. studio TXT (tiktok-developers-site-verification=...) -> Delete"
  Write-Host "  2. Add: studio | CNAME | 9cebe95476ced5bf.vercel-dns-017.com"
  exit 1
}

$domain = "egitim.today"
$teamId = $env:VERCEL_TEAM_ID
$teamQs = if ($teamId) { "?teamId=$teamId" } else { "" }
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$cnameTarget = "9cebe95476ced5bf.vercel-dns-017.com"
$txtRecordId = "rec_5452eb68f3d4ab0c5777304c"

Write-Host "=== List studio DNS records ==="
$list = Invoke-RestMethod -Uri "https://api.vercel.com/v5/domains/$domain/records$teamQs" -Headers $headers
$studio = $list.records | Where-Object { $_.name -eq "studio" }
$studio | ForEach-Object { Write-Host "$($_.type) $($_.name) -> $($_.value) id=$($_.id)" }

Write-Host "`n=== Delete studio TXT (TikTok verify — portal zaten onayli) ==="
try {
  Invoke-RestMethod -Method Delete -Uri "https://api.vercel.com/v2/domains/$domain/records/$txtRecordId$teamQs" -Headers $headers | Out-Null
  Write-Host "Deleted $txtRecordId"
} catch {
  Write-Host "Delete skipped or failed (kayit zaten silinmis olabilir): $_"
}

Write-Host "`n=== Create studio CNAME ==="
$body = @{ name = "studio"; type = "CNAME"; value = $cnameTarget; ttl = 60 } | ConvertTo-Json
try {
  $created = Invoke-RestMethod -Method Post -Uri "https://api.vercel.com/v2/domains/$domain/records$teamQs" -Headers $headers -Body $body
  Write-Host "Created CNAME studio -> $cnameTarget id=$($created.uid)"
} catch {
  if ($_.Exception.Message -match "conflict|already exists") {
    Write-Host "CNAME zaten var veya baska kayit conflict — Vercel panelden kontrol edin."
  } else { throw }
}

Write-Host "`n=== Done. 5-15 dk sonra: https://studio.egitim.today/admin ==="
Write-Host "TikTok URL verify yedek: https://studio.egitim.today/tiktokcZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ.txt"
