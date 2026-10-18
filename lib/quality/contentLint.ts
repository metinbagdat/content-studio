export type LintFinding = { penalty: number; reason: string }

const MIN_CHARS: Record<string, number> = {
  SOCIAL_CAPTION: 40,
  TWITTER_THREAD: 40,
  LINKEDIN_CAROUSEL: 40,
  SHORT_VIDEO_SCRIPT: 80,
  BLOG_POST: 200,
  VIDEO_SCRIPT: 80,
  PODCAST_SCRIPT: 80,
  MARCH_LYRICS: 40,
  SONG_LYRICS: 40,
  INFOGRAPHIC_TEXT: 40,
}

const PLACEHOLDER = /\b(lorem ipsum|todo|tbd|as an ai|\[buraya)\b/i

/** Deterministic copy checks. Penalties are points removed from a 100 start. */
export function lintDraft(input: { title: string; content: string; contentType: string }): LintFinding[] {
  const title = input.title.trim()
  const content = input.content.trim()
  const findings: LintFinding[] = []

  if (title.length < 8) {
    findings.push({ penalty: 25, reason: 'Başlık çok kısa' })
  }
  const min = MIN_CHARS[input.contentType] ?? 40
  if (content.length < min) {
    findings.push({ penalty: 35, reason: `İçerik ${min} karakterin altında` })
  }
  if (PLACEHOLDER.test(`${title}\n${content}`)) {
    findings.push({ penalty: 30, reason: 'Taslak yer tutucu metin içeriyor' })
  }
  if (title && content && title === content) {
    findings.push({ penalty: 15, reason: 'Başlık ile içerik aynı' })
  }
  return findings
}
