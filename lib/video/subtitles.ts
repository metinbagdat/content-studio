export type SubtitleCue = { start: number; end: number; text: string }

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Estimate per-sentence timing proportional to word count, scaled to fit totalDurationSec. */
export function buildSubtitleCues(text: string, totalDurationSec: number): SubtitleCue[] {
  const sentences = splitIntoSentences(text)
  if (!sentences.length) return []

  const wordCounts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length)
  const totalWords = wordCounts.reduce((a, b) => a + b, 0) || 1

  const cues: SubtitleCue[] = []
  let cursor = 0
  sentences.forEach((sentence, i) => {
    const share = wordCounts[i] / totalWords
    const duration = totalDurationSec * share
    cues.push({ start: cursor, end: cursor + duration, text: sentence })
    cursor += duration
  })
  return cues
}

function toSrtTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

export function cuesToSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue, i) => `${i + 1}\n${toSrtTimestamp(cue.start)} --> ${toSrtTimestamp(cue.end)}\n${cue.text}\n`)
    .join('\n')
}