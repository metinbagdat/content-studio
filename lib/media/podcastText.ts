/** Extract speakable plain text from PODCAST_SCRIPT JSON or fallback raw content. */
export function extractPodcastSpeech(content: string, title: string): string {
  try {
    const data = JSON.parse(content) as {
      intro?: string
      outro?: string
      segments?: Array<{ title?: string; script?: string }>
    }
    const parts: string[] = []
    if (data.intro) parts.push(data.intro)
    for (const seg of data.segments || []) {
      if (seg.title) parts.push(seg.title)
      if (seg.script) parts.push(seg.script)
    }
    if (data.outro) parts.push(data.outro)
    const joined = parts.join('\n\n').trim()
    if (joined) return joined.slice(0, 12_000)
  } catch {
    /* plain text fallback */
  }
  return `${title}\n\n${content}`.slice(0, 12_000)
}

/** Rough duration estimate from character count (~14 chars/sec Turkish speech). */
export function estimateSpeechDurationSec(text: string): number {
  return Math.max(5, Math.round(text.length / 14))
}
