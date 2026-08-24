# SEO hub article bundles

Each folder: `manifest.json` + `article.md` + `podcast-script.md` + `song-lyrics.md`

```powershell
npm run hub:publish -- --slug=karar-verme-hedef-belirleme-esenlik-dongusu --wp-only
npm run hub:publish -- --slug=karar-verme-hedef-belirleme-esenlik-dongusu --pipeline-only
```

## WordPress notes

- Drafts only via API. Human publishes after Safe SamurAI checkbox.
- **Close WP editor tabs before re-pushing** — Gutenberg autosave can overwrite a fresh REST body with an empty local buffer.
- Article slug (post 54): `karar-verme-hedef-belirleme-esenlik-dongusu`
- Podcast / anthem use their own CPT slugs from `manifest.json`.
- Rank Math focus keyword is set via API; reopen the editor (hard refresh) to see the score update.
