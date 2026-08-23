# SEO hub article bundles

Each folder: `manifest.json` + `article.md` + `podcast-script.md` + `song-lyrics.md`

```powershell
npm run hub:publish -- --slug=karar-verme-hedef-belirleme-esenlik-dongusu --wp-only
npm run hub:publish -- --slug=karar-verme-hedef-belirleme-esenlik-dongusu --pipeline-only
npm run hub:publish -- --slug=... --publish   # WP core REST publish (needs WP_USERNAME)
```

WP drafts → Safe SamurAI → human publish → webhook → CS (or `--pipeline-only` locally).
