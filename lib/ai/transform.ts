import { ContentType } from '@prisma/client'
import { brandCta } from '@content-studio/core/auth'
import { resolveLlm } from './llmClient'
import { captionMetadataWithImage } from '../social/brandImage'
import { fallbackPodcastScript, parsePodcastScript } from '../media/podcastSchema'
import { guardDraftOutput } from '../quality/draftOutputGuard'
import { buildTransformMessages, sanitizeArticle, type TransformKind, type TransformOptions } from './transformPrompt'

export type { TransformKind, TransformOptions }


function mockTransform(kind: TransformKind, title: string, content: string) {
  const snippet = content.slice(0, 280).replace(/\s+/g, ' ').trim()
  const cta = brandCta()
  switch (kind) {
    case 'SOCIAL_CAPTION':
      return {
        title: `Caption: ${title}`,
        content: `${title}\n\n${snippet}…${cta}\n\n#egitim #yks #ogrenme`,
        metadata: captionMetadataWithImage({ platformHints: ['TWITTER', 'LINKEDIN'], mock: true }),
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
    case 'PODCAST_SCRIPT': {
      const script = fallbackPodcastScript(title, snippet)
      return {
        title: `Podcast: ${title}`,
        content: JSON.stringify(script, null, 2),
        metadata: { durationMin: script.durationMin, mock: true },
      }
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
  options: TransformOptions = {},
): Promise<{ title: string; content: string; metadata: Record<string, unknown> }> {
  const { client: llm, provider, model } = resolveLlm()
  const epTotal = options.episodeTotal && options.episodeTotal > 1 ? options.episodeTotal : 1
  const epIndex = options.episodeIndex || 1
  const safeArticle = sanitizeArticle(article)

  if (!llm) {
    const mock = mockTransform(kind, title, safeArticle)
    if (kind === 'PODCAST_SCRIPT' && epTotal > 1) {
      return {
        ...mock,
        content: guardDraftOutput(mock.content).text,
        title: `Podcast ${epIndex}/${epTotal}: ${title}`,
        metadata: {
          ...mock.metadata,
          episodeIndex: epIndex,
          episodeTotal: epTotal,
          episodeFocus: options.episodeFocus || '',
        },
      }
    }
    return {
      ...mock,
      content: guardDraftOutput(mock.content).text,
    }
  }

  const built = buildTransformMessages(kind, title, article, options)
  const res = await llm.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: built.system },
      { role: 'user', content: built.user },
    ],
    temperature: 0.7,
  })

  const guarded = guardDraftOutput(res.choices[0]?.message?.content?.trim() || '')
  if (!guarded.ok) {
    return {
      title: `${kind}: ${title}`,
      content: guarded.text,
      metadata: { model, provider, mock: false, guarded: true },
    }
  }
  const text = guarded.text

  if (kind === 'PODCAST_SCRIPT') {
    const script = parsePodcastScript(text, title, article.slice(0, 600))
    return {
      title: epTotal > 1 ? `Podcast ${epIndex}/${epTotal}: ${title}` : `Podcast: ${title}`,
      content: JSON.stringify(script, null, 2),
      metadata: {
        model,
        provider,
        mock: false,
        durationMin: script.durationMin,
        segmentCount: script.segments.length,
        episodeIndex: epIndex,
        episodeTotal: epTotal,
        episodeFocus: options.episodeFocus || '',
        seriesTitle: title,
      },
    }
  }

  const metadata =
    kind === 'SOCIAL_CAPTION'
      ? captionMetadataWithImage({ model, provider, mock: false })
      : { model, provider, mock: false }
  return {
    title: `${kind}: ${title}`,
    content: text + (kind === 'SOCIAL_CAPTION' ? brandCta() : ''),
    metadata,
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
