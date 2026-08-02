import { z } from 'zod'

/** Structured podcast script — CS-05: intro cue → welcome → segments → takeaways → CTA → outro cue. */
export const podcastScriptSchema = z.object({
  introMusicCue: z.string().max(200).default('[5 sn jingle]'),
  welcome: z.string().min(1),
  segments: z
    .array(
      z.object({
        title: z.string().min(1),
        script: z.string().min(1),
      }),
    )
    .min(1),
  keyTakeaways: z.array(z.string()).default([]),
  cta: z.string().min(1),
  outroMusicCue: z.string().max(200).default('[3 sn outro jingle]'),
  durationMin: z.number().positive().default(10),
})

export type PodcastScript = z.infer<typeof podcastScriptSchema>

/** Best-effort default when the LLM output doesn't validate. */
export function fallbackPodcastScript(title: string, excerpt: string): PodcastScript {
  return {
    introMusicCue: '[5 sn jingle]',
    welcome: `Merhaba, egitim.today podcast'ine hoş geldiniz. Bugün konumuz: ${title}.`,
    segments: [{ title: 'Ana noktalar', script: excerpt || title }],
    keyTakeaways: [],
    cta: 'Detaylar ve daha fazlası için egitim.today adresini ziyaret edin.',
    outroMusicCue: '[3 sn outro jingle]',
    durationMin: 10,
  }
}

/** Parse + validate a podcast script; falls back to a minimal valid shape on any error. */
export function parsePodcastScript(raw: string, title: string, excerpt: string): PodcastScript {
  try {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    const json = JSON.parse(cleaned)
    // Accept the older {intro, segments, outro} shape too and upgrade it.
    if (json && typeof json === 'object' && !('welcome' in json) && 'intro' in json) {
      json.welcome = json.intro
      json.cta = json.cta || 'egitim.today ile öğrenmeye devam edin.'
    }
    const result = podcastScriptSchema.safeParse(json)
    if (result.success) return result.data
  } catch {
    /* fall through to fallback */
  }
  return fallbackPodcastScript(title, excerpt)
}
