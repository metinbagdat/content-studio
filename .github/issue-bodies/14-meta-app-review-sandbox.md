## Meta
- **ID:** CS-SM-00
- **Status:** in-progress
- **Parent:** CS-SM-EPIC
- **Repo:** content-studio

## Summary

Meta (FB/IG) developer ortamı, Login Configuration, App Review / Advanced Access ve Graph API testlerinin tamamlanması — production güvenli yayın için.

## Why now

2026-08-12: `pages_manage_posts` token scope’a eklendi (diagnose OK). Yine de:
- App hâlâ **Unpublished**
- **Data access renewal** due **2026-10-07**
- Bulk publish Meta **spam/rate-limit**’e takılıyor
- Advanced Access / Live olmadan ölçekli yayın kırılgan

## Checklist

### Developer app
- [x] Meta app `www.egitim.today` (1309132857965857) Business
- [x] Facebook Login for Business + Login Config `919581157862599` (`pages_manage_posts`)
- [x] Local OAuth: Kes → OAuth bağla → token’da `pages_manage_posts`
- [ ] App **Live** / yayın durumu
- [ ] **Required actions** → Data access renewal (≤ 2026-10-07)

### Permissions / Review
- [x] Use case: Manage everything on your Page (`pages_manage_posts` tanımlı)
- [ ] Advanced Access: `pages_manage_posts`
- [ ] Advanced Access: `instagram_content_publish` (IG gerçek yayın)
- [ ] Advanced Access: `pages_read_engagement` (metrikler)
- [ ] Uygulama İncelemesi: Doğrulama + Allowed usage + Reviewer instructions → Submit

### Test
- [ ] App roles / Test Users (gerekirse ikinci hesap)
- [ ] Graph API Explorer: `GET /me/accounts`, `POST /{page-id}/feed` (test)
- [x] Content Studio: Facebook toplu yayın (batch ≤8, gap ~2.5s) spam early-stop
- [x] `scripts/diagnose-meta-fb.ts` scope + data-access renewal notu
- [x] Docs: `docs/META_FACEBOOK_SETUP.md` + `/admin/social` renewal banner

### TikTok / LinkedIn (kısa)
- [ ] TikTok Desktop + Sandbox OAuth (local)
- [ ] LinkedIn org post (`LINKEDIN_ORG_POST`) prod parity

## Done when

- [ ] Live app + Advanced Access (en az `pages_manage_posts`)
- [ ] Data access renewal tamam veya takvimde
- [ ] Local/prod Facebook publish spam limit altında sürdürülebilir
- [ ] Docs: `docs/META_FACEBOOK_SETUP.md` güncel

## Notes

- Vercel prebuilt → Redeploy yok; `gh workflow run deploy-production.yml`
- Env: `META_OAUTH_PUBLISH=true`, `META_LOGIN_CONFIG_ID_PUBLISH=919581157862599`
- Spam 400: batch’i küçült / 30–60 dk bekle; hız limitini yükseltmek tek başına çözüm değil
