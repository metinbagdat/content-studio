## Meta
- **GitHub:** #41

## Summary
Disconnect on `/admin/social` returns success but the X (and other OAuth) card can stay "connected".

## Causes (both real)

1. **Token refresh resurrection:** `persistTokens()` set `isActive: true` on every refresh. Page load auto-runs `sync-stats` (and worker `ANALYTICS_SYNC`). A race or a still-active query can revive a just-disconnected account.
2. **Dry-run fallback:** `pickPreferredAccount` prefers real OAuth, then dry-run. Disconnecting only the OAuth row leaves an active `dryrun_twitter` (or similar) so the card remains.

`deactivateAccount` + UI `load()` were already correct. Do not remove Faz-2 dry-run bootstrap for YouTube/Instagram/TikTok/Facebook pipeline slots.

## Fix
- [x] `getValidAccessToken` refuses inactive accounts (no refresh)
- [x] `persistTokens` does not touch `isActive`
- [x] Disconnect also deactivates same-platform `dryrun_*` rows
- [x] `syncAccountStats` skips inactive
