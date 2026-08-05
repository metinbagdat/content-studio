import { cleanPodcastTitle, parsePodcastScript } from './podcastSchema'
import { ttsPronunciation } from './pronunciation'

/** Editing notes / music cues — never spoken. */
export function isMusicCue(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (/^\[.*\]$/.test(t)) return true
  if (/^\(.*\)$/.test(t) && /jingle|müzik|music|sn\s/i.test(t)) return true
  if (/^(intro|outro)\s*(music|müzik)/i.test(t)) return true
  if (/^PODCAST_SCRIPT:/i.test(t)) return true
  if (/jingle|müzik\s*bed|music\s*cue|arka\s*plan\s*müzi/i.test(t) && t.length < 120) return true
  return false
}

export type PodcastSpeechParts = {
  /** Ordered speakable blocks: welcome → segment scripts → takeaways → cta */
  parts: string[]
  fullText: string
}

export type ExtractPodcastOptions = {
  /** Source article excerpt — used when JSON parse fails */
  excerpt?: string
}

/** Extract only spoken podcast fields — skips titles, music cues, metadata. */
export function extractPodcastSpeechParts(
  content: string,
  title: string,
  options: ExtractPodcastOptions = {},
): PodcastSpeechParts {
  const topic = cleanPodcastTitle(title)
  const excerpt = options.excerpt || ''
  const script = parsePodcastScript(content, topic, excerpt)

  const rawParts: string[] = []

  if (script.welcome && !isMusicCue(script.welcome)) {
    rawParts.push(script.welcome)
  }

  for (const seg of script.segments) {
    if (seg.script && !isMusicCue(seg.script)) {
      rawParts.push(seg.script)
    }
  }

  const takeaways = script.keyTakeaways.filter((t) => t && !isMusicCue(t))
  if (takeaways.length) {
    rawParts.push(takeaways.join('. '))
  }

  if (script.cta && !isMusicCue(script.cta)) {
    rawParts.push(script.cta)
  }

  const parts = rawParts.map((p) => ttsPronunciation(p)).filter(Boolean)

  return {
    parts,
    fullText: parts.join('\n\n'),
  }
}

/** Flat speakable text (all parts joined). */
export function extractPodcastSpeech(
  content: string,
  title: string,
  options: ExtractPodcastOptions = {},
): string {
  return extractPodcastSpeechParts(content, title, options).fullText.slice(0, 12_000)
}

/** Rough duration estimate from character count (~14 chars/sec Turkish speech). */
export function estimateSpeechDurationSec(text: string): number {
  return Math.max(5, Math.round(text.length / 14))
}
