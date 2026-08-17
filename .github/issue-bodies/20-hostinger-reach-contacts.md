## Meta
- **ID:** CS-EM-01
- **Repo:** content-studio
- **Sprint:** email
- **GitHub:** #38

## Summary
Hostinger Reach public API ile **kişi** oluştur / listele. Kampanya gönderimi Reach panelinde kalır (send endpoint yok).

## Scope
- [x] `lib/email/hostingerReach.ts` (`HOSTINGER_API_TOKEN`, isteğe bağlı `HOSTINGER_REACH_PROFILE_UUID`)
- [x] `GET/POST /api/email/reach` (`x-admin-key`)
- [x] Docs: `docs/HOSTINGER_REACH.md`
- [ ] Live smoke: Reach token Vercel/local’de

## Out of scope
- LearnCon transactional mail (LC-G4)
- Kampanya oluştur / Send (Reach UI)
