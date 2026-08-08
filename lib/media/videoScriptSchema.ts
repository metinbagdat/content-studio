import { isMusicCue } from './podcastText'

export type VideoScriptSegment = { text: string; visualPrompt: string }

const VISUAL_KEYS = ['visuals', 'visual', 'description'] as const

function unfence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

function pickString(obj: unknown, keys: readonly string[], fallback = ''): string {
  if (!obj || typeof obj !== 'object') return fallback
  const rec = obj as Record<string, unknown>
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return fallback
}

/** Metadata, JSON keys, timestamps — never spoken in TTS. */
export function isNonSpeakableVideoText(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (isMusicCue(t)) return true
  if (/^"[\w]+"\s*:/.test(t)) return true
  if (/^[\[{][\s\S]*[\]}]$/.test(t) && /"(hook|scenes|callToAction|caption|durationSec)"/.test(t)) {
    return true
  }
  if (/^\d+\s*-\s*\d+\s*s?$/i.test(t)) return true
  if (/^(hook|scenes|callToAction|caption|durationSec|visual|visuals|narration|voice)\s*:/i.test(t)) {
    return true
  }
  return false
}

export function cleanVideoTitle(title: string): string {
  return title
    .replace(/^VIDEO_SCRIPT:\s*/i, '')
    .replace(/^SHORT_VIDEO_SCRIPT:\s*/i, '')
    .replace(/^Video:\s*/i, '')
    .trim()
}

function visualFromScene(scene: unknown, fallback: string): string {
  const v = pickString(scene, VISUAL_KEYS, fallback)
  return v || fallback
}

function lenientParseVideoJson(json: unknown, fallbackVisual: string): VideoScriptSegment[] {
  if (!json || typeof json !== 'object') return []
  const o = json as Record<string, unknown>
  const segments: VideoScriptSegment[] = []

  const scenes = Array.isArray(o.scenes) ? o.scenes : []
  const firstVisual = scenes.length ? visualFromScene(scenes[0], fallbackVisual) : fallbackVisual

  const hook = pickString(o, ['hook'])
  if (hook && !isNonSpeakableVideoText(hook)) {
    segments.push({ text: hook, visualPrompt: firstVisual })
  }

  for (const scene of scenes) {
    const narration = pickString(scene, ['narration', 'voice'])
    const visual = visualFromScene(scene, fallbackVisual)
    if (narration && !isNonSpeakableVideoText(narration)) {
      segments.push({ text: narration, visualPrompt: visual })
    }
  }

  const cta = pickString(o, ['callToAction', 'cta'])
  if (cta && !isNonSpeakableVideoText(cta)) {
    const cleaned = cta.replace(/https?:\/\/\S+/g, '').trim()
    if (cleaned) {
      segments.push({
        text: cleaned,
        visualPrompt: 'warm inviting education technology, logo card, soft gradient',
      })
    }
  }

  return segments
}

/** Salvage quoted strings from malformed JSON — last resort before title fallback. */
function salvageBrokenJsonStrings(raw: string): VideoScriptSegment[] {
  const matches = [...raw.matchAll(/"(?:hook|narration|voice|callToAction|cta)"\s*:\s*"((?:\\.|[^"\\])*)"/gi)]
  const segments: VideoScriptSegment[] = []
  for (const m of matches) {
    const text = m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').trim()
    if (text && !isNonSpeakableVideoText(text)) {
      segments.push({ text, visualPrompt: 'educational illustration, soft gradient' })
    }
  }
  return segments
}

/** Parse VIDEO_SCRIPT / SHORT_VIDEO_SCRIPT — only speakable narration, never raw JSON. */
export function parseVideoScript(raw: string, title: string, fallbackVisual: string): VideoScriptSegment[] {
  const cleaned = unfence(raw)

  try {
    const json = JSON.parse(cleaned)
    const segments = lenientParseVideoJson(json, fallbackVisual)
    if (segments.length) return segments
  } catch {
    /* not valid JSON */
  }

  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    const salvaged = salvageBrokenJsonStrings(cleaned)
    if (salvaged.length) return salvaged
    const topic = cleanVideoTitle(title) || fallbackVisual
    return [{ text: topic, visualPrompt: fallbackVisual }]
  }

  const plain = cleaned.trim()
  if (plain && !isNonSpeakableVideoText(plain)) {
    return [{ text: plain, visualPrompt: fallbackVisual }]
  }

  const topic = cleanVideoTitle(title) || fallbackVisual
  return [{ text: topic, visualPrompt: fallbackVisual }]
}

export type VisualSlide = { visualPrompt: string; durationSec: number; subtitleText: string }

/** Split long narration segments into shorter visual slides (~3.5s) for fluid image changes. */
export function expandVisualSlides(
  segments: VideoScriptSegment[],
  segmentDurations: number[],
  maxSlideSec = 3.5,
): VisualSlide[] {
  const slides: VisualSlide[] = []

  segments.forEach((seg, i) => {
    const totalDur = segmentDurations[i] || maxSlideSec
    const slideCount = Math.max(1, Math.ceil(totalDur / maxSlideSec))
    const slideDur = totalDur / slideCount

    const sentences = seg.text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)

    for (let j = 0; j < slideCount; j++) {
      const angle =
        slideCount > 1 ? `, dynamic perspective ${j + 1}, cinematic motion blur hint` : ''
      const subtitleText =
        slideCount === 1
          ? seg.text
          : sentences[j] || (j === 0 ? seg.text : '')

      slides.push({
        visualPrompt: `${seg.visualPrompt}${angle}`,
        durationSec: slideDur,
        subtitleText,
      })
    }
  })

  return slides
}
