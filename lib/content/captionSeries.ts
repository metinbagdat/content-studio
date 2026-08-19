import { shareCtaBlock } from './canonicalUrl'
import { captionMetadataWithImage } from '../social/brandImage'

export type CaptionPart = {
  title: string
  content: string
  heading: string
  partIndex: number
  partTotal: number
}

const HASHTAGS = '#egitim #planlama #zaman #egitimtoday'

function splitSections(markdown: string): Array<{ heading: string; body: string }> {
  const chunks = markdown.split(/\n##\s+/).filter(Boolean)
  return chunks.map((chunk, i) => {
    const lines = chunk.trim().split('\n')
    const heading = i === 0 && !markdown.trimStart().startsWith('##') ? lines[0]?.replace(/^#\s*/, '') || 'Giriş' : lines[0]?.trim() || `Bölüm ${i + 1}`
    const bodyStart = i === 0 && !markdown.trimStart().startsWith('##') ? 1 : 1
    const body = lines.slice(bodyStart).join('\n').trim()
    return { heading, body: body || lines.slice(1).join('\n').trim() }
  })
}

/** Build 4-part social caption series from article (title always on part 1). */
export function buildCaptionSeries(
  articleTitle: string,
  articleMarkdown: string,
  maxParts = 4,
  articleUrl?: string,
): CaptionPart[] {
  const sections = splitSections(articleMarkdown.replace(/^#\s+[^\n]+\n?/, ''))
  const cta = shareCtaBlock(articleUrl)

  const perPart = Math.max(1, Math.ceil(sections.length / maxParts))
  const buckets: Array<{ heading: string; bodies: string[] }> = []

  for (let i = 0; i < maxParts; i++) {
    const slice = sections.slice(i * perPart, (i + 1) * perPart)
    if (!slice.length) break
    buckets.push({
      heading: slice[0].heading,
      bodies: slice.flatMap((s) => (s.body ? [s.body] : [])),
    })
  }

  const parts: CaptionPart[] = buckets
    .map((b, idx) => {
      const partNum = idx + 1
      const heading = b.heading.replace(/^#+\s*/, '').trim()
      const body = b.bodies.join('\n\n').trim()
      if (!body) return null

      const titleLine = partNum === 1 ? `${articleTitle}\n\n` : ''
      const partLabel = `\n\n(${partNum}/${maxParts})`
      const suffix = partNum === maxParts ? `${cta}\n\n${HASHTAGS}` : partLabel

      const content = `${titleLine}**${heading}**\n\n${body}${suffix}`.trim()
      return {
        title: `Caption ${partNum}/${maxParts}: ${articleTitle}`,
        content,
        heading,
        partIndex: partNum,
        partTotal: maxParts,
      }
    })
    .filter(Boolean) as CaptionPart[]

  return parts.length ? parts : [
    {
      title: `Caption 1/1: ${articleTitle}`,
      content: `${articleTitle}\n\n${articleMarkdown.slice(0, 1200)}${cta}\n\n${HASHTAGS}`,
      heading: articleTitle,
      partIndex: 1,
      partTotal: 1,
    },
  ]
}

export function captionPartMetadata(
  part: CaptionPart,
  seriesId: string,
  articleTitle: string,
  articleUrl?: string,
): Record<string, unknown> {
  return captionMetadataWithImage({
    seriesId,
    partIndex: part.partIndex,
    partTotal: part.partTotal,
    sectionHeading: part.heading,
    articleTitle,
    articleUrl,
    platformHints: ['LINKEDIN'],
  })
}
