import { brandCta } from '../auth'
import type { AtomKind, AtomMetadata } from './types-derivative'

export type ArticleSection = { heading: string; body: string }

export function splitArticleSections(markdown: string): ArticleSection[] {
  const chunks = markdown.split(/\n##\s+/).filter(Boolean)
  return chunks.map((chunk, i) => {
    const lines = chunk.trim().split('\n')
    const heading =
      i === 0 && !markdown.trimStart().startsWith('##')
        ? lines[0]?.replace(/^#+\s*/, '') || 'Giriş'
        : lines[0]?.replace(/^#+\s*/, '').trim() || `Bölüm ${i + 1}`
    const bodyStart = 1
    const body = lines.slice(bodyStart).join('\n').trim()
    return { heading, body: body || lines.slice(1).join('\n').trim() }
  })
}

export function articleExcerpt(article: string, max = 3000): string {
  return article.slice(0, max)
}

export function pickConcepts(
  keyConcepts: string[],
  sections: ArticleSection[],
  count: number,
): string[] {
  const fromSections = sections.map((s) => s.heading).filter(Boolean)
  const pool = [...keyConcepts, ...fromSections]
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(pool[i % pool.length] || `Nokta ${i + 1}`)
  }
  return out
}

export function baseMetadata(
  atomKind: AtomKind,
  articleTitle: string,
  articleUrl?: string,
  extra: Record<string, unknown> = {},
): AtomMetadata & Record<string, unknown> {
  return {
    atomKind,
    articleTitle,
    articleUrl,
    autoGenerateImage: atomKind.includes('post') || atomKind === 'social_card',
    ...extra,
  }
}

export { brandCta }
