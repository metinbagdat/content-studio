import OpenAI from 'openai'
import { ContentType } from '@prisma/client'
import { brandCta } from '../auth'

export type TransformKind =
  | 'VIDEO_SCRIPT'
  | 'PODCAST_SCRIPT'
  | 'SOCIAL_CAPTION'
  | 'BLOG_POST'
  | 'MARCH_LYRICS'
  | 'SONG_LYRICS'

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })
}

function mockTransform(kind: TransformKind, title: string, content: string) {
  const snippet = content.slice(0, 280).replace(/\s+/g, ' ').trim()
  const cta = brandCta()
  switch (kind) {
    case 'SOCIAL_CAPTION':
      return {
        title: `Caption: ${title}`,
        content: `${title}\n\n${snippet}…${cta}\n\n#egitim #yks #ogrenme`,
        metadata: { platformHints: ['TWITTER', 'LINKEDIN'], mock: true },
      }
    case 'VIDEO_SCRIPT':
      return {
        title: `Video script: ${title}`,
        content: JSON.stringify(
          {
            hook: `3 sn: ${title}`,
            scenes: [
              { t: '0-5s', visual: 'Hook text', voice: snippet.slice(0, 80) },
              { t: '5-45s', visual: 'Key points', voice: snippet },
              { t: '45-60s', visual: 'CTA egitim.today', voice: 'Detay için egitim.today' },
            ],
            durationSec: 60,
          },
          null,
          2,
        ),
        metadata: { style: 'educational', mock: true },
      }
    case 'PODCAST_SCRIPT':
      return {
        title: `Podcast: ${title}`,
        content: JSON.stringify(
          {
            intro: `Bugün: ${title}`,
            segments: [{ title: 'Ana noktalar', script: snippet }],
            outro: 'egitim.today ile öğrenmeye devam.',
            durationMin: 10,
          },
          null,
          2,
        ),
        metadata: { durationMin: 10, mock: true },
      }
    case 'BLOG_POST':
      return {
        title: title,
        content: `# ${title}\n\n${snippet}\n\n## Özet\n\n${snippet}\n\n[egitim.today](https://egitim.today)`,
        metadata: {
          seo: {
            metaTitle: `${title} | egitim.today`,
            metaDescription: snippet.slice(0, 155),
            slug: title
              .toLowerCase()
              .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
              .trim()
              .replace(/\s+/g, '-')
              .slice(0, 80),
          },
          mock: true,
        },
      }
    case 'MARCH_LYRICS':
      return {
        title: `Marş: ${title}`,
        content: JSON.stringify(
          {
            verse1: ['Birlikte öğreniriz', 'Hedefe yürürüz'],
            chorus: ['egitim.today', 'Yarına hazırız'],
          },
          null,
          2,
        ),
        metadata: { style: 'motivational', mock: true },
      }
    case 'SONG_LYRICS':
      return {
        title: `Şarkı: ${title}`,
        content: JSON.stringify(
          {
            verse1: snippet.slice(0, 120),
            chorus: `${title} — öğren, büyü, paylaş`,
          },
          null,
          2,
        ),
        metadata: { genre: 'pop', mock: true },
      }
  }
}

export async function generateTransform(
  kind: TransformKind,
  title: string,
  article: string,
): Promise<{ title: string; content: string; metadata: Record<string, unknown> }> {
  const openai = client()
  if (!openai) return mockTransform(kind, title, article)

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const prompts: Record<TransformKind, string> = {
    SOCIAL_CAPTION: `Write a Turkish social caption for X and LinkedIn promoting egitim.today. Include CTA. Article title: ${title}\n\n${article.slice(0, 3000)}`,
    VIDEO_SCRIPT: `Create a 60s educational short-form video script (JSON: hook, scenes[], durationSec) in Turkish for egitim.today. Title: ${title}\n\n${article.slice(0, 3000)}`,
    PODCAST_SCRIPT: `Create a ~10 min podcast outline JSON (intro, segments[], outro) in Turkish. Title: ${title}\n\n${article.slice(0, 3000)}`,
    BLOG_POST: `Write a short Turkish blog post (markdown) plus SEO meta JSON fields metaTitle, metaDescription, slug. Title: ${title}\n\n${article.slice(0, 3000)}`,
    MARCH_LYRICS: `Write short motivational march lyrics JSON (verse1, chorus) in Turkish inspired by: ${title}`,
    SONG_LYRICS: `Write short song lyrics JSON (verse1, chorus) in Turkish inspired by: ${title}`,
  }

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You help egitim.today marketing. Prefer Turkish. Always include brand CTA to https://egitim.today where appropriate. Return useful text; for structured types prefer JSON.',
      },
      { role: 'user', content: prompts[kind] },
    ],
    temperature: 0.7,
  })

  const text = res.choices[0]?.message?.content?.trim() || ''
  return {
    title: `${kind}: ${title}`,
    content: text + (kind === 'SOCIAL_CAPTION' ? brandCta() : ''),
    metadata: { model, mock: false },
  }
}

export const FAZ1_KINDS: TransformKind[] = [
  'SOCIAL_CAPTION',
  'VIDEO_SCRIPT',
  'PODCAST_SCRIPT',
  'BLOG_POST',
]

export function toContentType(kind: TransformKind): ContentType {
  return kind as ContentType
}
