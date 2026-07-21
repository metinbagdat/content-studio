# Faz 2 — Medya üretimi

## Faz 2a (canlı) — Podcast MP3

| Adım | Durum |
|------|--------|
| PODCAST_SCRIPT → TTS → MP3 | ✅ |
| Admin oynatıcı `/admin/media` | ✅ |
| Onay ekranından "Ses üret" linki | ✅ |

**TTS varsayılan:** Microsoft Edge TTS (ücretsiz, `edge-tts` paketi). Ek API key gerekmez.

**Alternatif:** `TTS_PROVIDER=openai` + gerçek `OPENAI_API_KEY` (Groq key ile çalışmaz).

### Kullanım

1. Pipeline → PODCAST_SCRIPT onayla
2. `/admin/review` → **Ses üret** veya `/admin/media`
3. MP3 üret → sayfada `<audio>` ile dinle

Dosyalar: `storage/audio/{mediaId}.mp3` (gitignore)

---

## Faz 2b (planlı) — Kısa video

- VIDEO_SCRIPT → sahneler + görseller + FFmpeg → MP4
- Admin video oynatıcı

---

## Faz 2c (planlı) — Şarkı / marş ses

- SONG_LYRICS / MARCH_LYRICS → Suno/Udio veya TTS + müzik yatağı
- YouTube / TikTok upload (Faz 2 platform OAuth)

---

## Platform OAuth zamanlaması

| Ne zaman | Ne |
|----------|-----|
| **Şimdi** | X + LinkedIn metin (OAuth kurulumun) |
| **Podcast MP3 sonrası** | YouTube kanal + video upload API |
| **Video pipeline sonrası** | TikTok |
| **Faz 3** | Meta (Facebook / Instagram) |

OAuth denemelerini bitirmeden YouTube/TikTok app açmana gerek yok; metin + podcast MP3 ile akışı doğrulamak yeterli.
