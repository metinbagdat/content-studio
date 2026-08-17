export type SubtitleCue = { start: number; end: number; text: string }

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function splitLongPhrase(s: string, maxWords = 10): string[] {
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return [s]
  const out: string[] = []
  for (let i = 0; i < words.length; i += maxWords) {
    out.push(words.slice(i, i + maxWords).join(' '))
  }
  return out
}

/** Wrap to at most two lines for burned-in captions (Shorts/Reels safe). */
export function wrapSubtitleText(text: string, maxChars = 28): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return ''
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= maxChars) {
      cur = next
      continue
    }
    if (cur) lines.push(cur)
    cur = w
    if (lines.length >= 1) break
  }
  if (cur && lines.length < 2) lines.push(cur)
  return lines.join('\n')
}

/** Estimate per-sentence timing proportional to word count, scaled to fit totalDurationSec. */
export function buildSubtitleCues(text: string, totalDurationSec: number): SubtitleCue[] {
  const phrases = splitIntoSentences(text).flatMap((s) => splitLongPhrase(s, 10))
  if (!phrases.length) return []

  const wordCounts = phrases.map((s) => s.split(/\s+/).filter(Boolean).length)
  const totalWords = wordCounts.reduce((a, b) => a + b, 0) || 1

  const cues: SubtitleCue[] = []
  let cursor = 0
  phrases.forEach((phrase, i) => {
    const share = wordCounts[i] / totalWords
    const duration = Math.max(1.2, totalDurationSec * share)
    cues.push({ start: cursor, end: cursor + duration, text: wrapSubtitleText(phrase, 28) })
    cursor += duration
  })

  if (cursor > 0 && Math.abs(cursor - totalDurationSec) > 0.05) {
    const scale = totalDurationSec / cursor
    for (const cue of cues) {
      cue.start *= scale
      cue.end *= scale
    }
  }
  return cues
}

function toSrtTimestamp(sec: number): string {
  const clamped = Math.max(0, sec)
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  const s = Math.floor(clamped % 60)
  const ms = Math.min(999, Math.round((clamped - Math.floor(clamped)) * 1000))
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

export function cuesToSrt(cues: SubtitleCue[], maxChars = 28): string {
  return cues
    .map((cue, i) => {
      const text = wrapSubtitleText(cue.text.replace(/\n/g, ' '), maxChars)
      return `${i + 1}\n${toSrtTimestamp(cue.start)} --> ${toSrtTimestamp(cue.end)}\n${text}\n`
    })
    .join('\n')
}

export function subtitleMaxChars(aspect: '16:9' | '9:16' | '1:1'): number {
  return aspect === '9:16' ? 26 : 40
}
