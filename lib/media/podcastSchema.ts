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

/** Strip content-type prefixes from derived titles — never spoken. */
export function cleanPodcastTitle(title: string): string {
  return title
    .replace(/^PODCAST_SCRIPT:\s*/i, '')
    .replace(/^Podcast:\s*/i, '')
    .replace(/^Podcast script:\s*/i, '')
    .trim()
}

function pickString(obj: unknown, keys: string[], fallback = ''): string {
  if (!obj || typeof obj !== 'object') return fallback
  const rec = obj as Record<string, unknown>
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return fallback
}

function pickStringArray(obj: unknown, key: string): string[] {
  if (!obj || typeof obj !== 'object') return []
  const v = (obj as Record<string, unknown>)[key]
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

/** When strict zod fails, still salvage welcome/segments/cta from LLM JSON. */
export function lenientParsePodcastScript(
  json: unknown,
  title: string,
  excerpt: string,
): PodcastScript | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  const topic = cleanPodcastTitle(title)

  let welcome = pickString(o, ['welcome'])
  const intro = pickString(o, ['intro'])
  if (!welcome && intro && !/^\[.*\]$/.test(intro) && !/jingle/i.test(intro)) {
    welcome = intro
  }

  const segments: Array<{ title: string; script: string }> = []
  const rawSegs = o.segments ?? o.scenes
  if (Array.isArray(rawSegs)) {
    for (const item of rawSegs) {
      const script = pickString(item, ['script', 'narration', 'voice'])
      if (!script || /^\[.*\]$/.test(script)) continue
      segments.push({
        title: pickString(item, ['title'], 'Bölüm') || 'Bölüm',
        script,
      })
    }
  }

  const keyTakeaways = pickStringArray(o, 'keyTakeaways')
  let cta = pickString(o, ['cta', 'callToAction'])
  const outro = pickString(o, ['outro'])
  if (!cta && outro && !/^\[.*\]$/.test(outro) && !/jingle/i.test(outro)) {
    cta = outro
  }

  if (!welcome && !segments.length && !cta) return null

  return {
    introMusicCue: pickString(o, ['introMusicCue'], '[5 sn jingle]') || '[5 sn jingle]',
    welcome:
      welcome ||
      `Merhaba, egitim.today podcast'ine hoş geldiniz. Bugün konumuz: ${topic}.`,
    segments: segments.length
      ? segments
      : [{ title: 'Ana noktalar', script: excerpt.slice(0, 4000) || topic }],
    keyTakeaways,
    cta: cta || 'Detaylar ve daha fazlası için www nokta egitim nokta tudey adresini ziyaret edin.',
    outroMusicCue: pickString(o, ['outroMusicCue'], '[3 sn outro jingle]') || '[3 sn outro jingle]',
    durationMin: typeof o.durationMin === 'number' ? o.durationMin : 10,
  }
}

/** Best-effort default when the LLM output doesn't validate. */
export function fallbackPodcastScript(title: string, excerpt: string): PodcastScript {
  const topic = cleanPodcastTitle(title)
  return {
    introMusicCue: '[5 sn jingle]',
    welcome: `Merhaba, egitim.today podcast'ine hoş geldiniz. Bugün konumuz: ${topic}.`,
    segments: [{ title: 'Ana noktalar', script: excerpt.slice(0, 4000) || topic }],
    keyTakeaways: [],
    cta: 'Detaylar ve daha fazlası için www nokta egitim nokta tudey adresini ziyaret edin.',
    outroMusicCue: '[3 sn outro jingle]',
    durationMin: 10,
  }
}

/** Parse + validate a podcast script; lenient salvage before minimal fallback. */
export function parsePodcastScript(raw: string, title: string, excerpt: string): PodcastScript {
  try {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    const json = JSON.parse(cleaned)
    if (json && typeof json === 'object' && !('welcome' in json) && 'intro' in json) {
      const intro = (json as Record<string, unknown>).intro
      if (typeof intro === 'string' && !/^\[.*\]$/.test(intro) && !/jingle/i.test(intro)) {
        ;(json as Record<string, unknown>).welcome = intro
      }
      if (!(json as Record<string, unknown>).cta) {
        ;(json as Record<string, unknown>).cta = 'egitim.today ile öğrenmeye devam edin.'
      }
    }
    const result = podcastScriptSchema.safeParse(json)
    if (result.success) return result.data

    const lenient = lenientParsePodcastScript(json, title, excerpt)
    if (lenient) return lenient
  } catch {
    /* fall through */
  }
  return fallbackPodcastScript(title, excerpt)
}
