# Domain hatırlatıcıları

## learnconnect.net

| Alan | Değer |
|------|--------|
| Registrar | name.com |
| WHOIS bitiş (kontrol: Nis 2026) | **21 Kasım 2026** |
| Windows görev | `LearnConnect.net-yenile` → **1 Kasım 2026 10:00** |
| Aksiyon | name.com → giriş → learnconnect.net **Renew** veya hesap erişimini düzelt |

Google hesabı / transfer sorunu varsa **şimdi** name.com destek ile iletişime geçin — domain hâlâ kayıtlı olabilir, sadece DNS kaldırılmış olabilir.

### name.com DNS (learnconnect geri alınınca)

| Type | Host | Value |
|------|------|--------|
| CNAME | `www` | learncon projesinin Vercel DNS hedefi |

---

## studio.egitim.today

| Proje | content-studio |
| DNS | Vercel nameservers (egitim.today) |

**CNAME + TXT ayni isimde olamaz.** TikTok onayliysa TXT silin, CNAME ekleyin:

1. Vercel → egitim.today → DNS → **Delete** `studio` TXT (`tiktok-developers-site-verification=...`)
2. **Add** `studio` | **CNAME** | `9cebe95476ced5bf.vercel-dns-017.com`
3. content-studio → Domains → Refresh

Otomasyon (VERCEL_TOKEN gerekir):

```powershell
$env:VERCEL_TOKEN = "..."
$env:VERCEL_TEAM_ID = "team_N4H4fEI4NH7mO7l4hLDKBX03"
powershell -ExecutionPolicy Bypass -File scripts/fix-studio-dns-vercel.ps1
```

TikTok URL yedek (TXT silindikten sonra): `/tiktokcZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ.txt`

---

## Proje özeti

| Domain | Vercel projesi |
|--------|----------------|
| egitim.today, www | learncon |
| studio.egitim.today | content-studio |
| www.learnconnect.net | learncon (domain şu an NXDOMAIN) |
