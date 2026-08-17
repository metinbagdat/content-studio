import { splitArticleSections } from '../atomization/articleChunks'

export type PodcastEpisodeChunk = {
  index: number
  total: number
  heading: string
  body: string
}

/** Long articles become 2–3 episodes; short ones stay a single ~10 min script. */
export function suggestedPodcastEpisodeCount(article: string, planned = 1): number {
  const chars = article.replace(/\s+/g, ' ').trim().length
  let byLength = 1
  if (chars >= 4500) byLength = 2
  if (chars >= 9000) byLength = 3
  const fromPlan = Math.max(1, Math.min(3, Number(planned) || 1))
  return Math.min(3, Math.max(byLength, fromPlan))
}

function packBySize(sections: Array<{ heading: string; body: string }>, count: number): PodcastEpisodeChunk[] {
  const items = sections.map((s) => ({
    heading: s.heading,
    body: s.body.trim() ? `## ${s.heading}\n\n${s.body}` : s.heading,
    size: s.heading.length + s.body.length,
  }))
  const buckets: Array<{ heading: string; parts: string[]; size: number }> = Array.from({ length: count }, (_, i) => ({
    heading: items[i]?.heading || `Bölüm ${i + 1}`,
    parts: [],
    size: 0,
  }))
  for (const item of items) {
    let best = 0
    for (let i = 1; i < buckets.length; i++) {
      if (buckets[i].size < buckets[best].size) best = i
    }
    if (!buckets[best].parts.length) buckets[best].heading = item.heading
    buckets[best].parts.push(item.body)
    buckets[best].size += item.size
  }
  return buckets
    .filter((b) => b.parts.length)
    .map((b, i, arr) => ({
      index: i + 1,
      total: arr.length,
      heading: b.heading,
      body: b.parts.join('\n\n'),
    }))
}

export function splitArticleForEpisodes(article: string, episodeCount: number): PodcastEpisodeChunk[] {
  const n = Math.max(1, Math.min(3, episodeCount))
  if (n === 1) {
    return [{ index: 1, total: 1, heading: '', body: article }]
  }

  const sections = splitArticleSections(article).filter((s) => s.body.trim().length > 40 || s.heading)
  if (sections.length >= n) {
    return packBySize(sections, n)
  }

  const trimmed = article.trim()
  const chunk = Math.ceil(trimmed.length / n)
  const out: PodcastEpisodeChunk[] = []
  for (let i = 0; i < n; i++) {
    const body = trimmed.slice(i * chunk, (i + 1) * chunk).trim()
    if (!body) continue
    out.push({ index: out.length + 1, total: n, heading: `Bölüm ${i + 1}`, body })
  }
  return out.map((e, i, arr) => ({ ...e, index: i + 1, total: arr.length }))
}
