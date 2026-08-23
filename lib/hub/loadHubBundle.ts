import { readFile } from 'fs/promises'
import path from 'path'
import type { AudienceSegment } from '../audience/segments'
import { isAudienceSegment, withSegmentTag } from '../audience/segments'
import type { PlatformId } from '@content-studio/core/platforms/targets'
import { platformsForSegment } from '../audience/segments'

export type HubManifest = {
  slug: string
  title: string
  seoTitle: string
  excerpt: string
  segment: AudienceSegment
  category: string
  wpCategories: string[]
  wpTags: string[]
  skillTags: string[]
  internalLinks: string[]
  hkmt: {
    hkmt_hazir_durum: string
    hkmt_kavramsal_hedef: string
    hkmt_metodoloji: string
    hkmt_takip_transformasyon: string
    hkmt_search_value_score: number
    hkmt_hpv_score: number
  }
  podcast: {
    title: string
    slug: string
    durationMinutes: number
    episodeNumber: number
  }
  anthem: {
    title: string
    slug: string
  }
  pipeline?: {
    includeMarchSong?: boolean
    marchStyle?: string
    musicGenre?: string
    podcastDurationMinutes?: number
    videoStyle?: string
  }
}

export type HubBundle = {
  manifest: HubManifest
  articleMarkdown: string
  podcastScriptMarkdown: string
  songLyricsMarkdown: string
  tags: string[]
  platforms: PlatformId[]
}

function hubRoot(slug: string): string {
  return path.join(process.cwd(), 'content', 'hub', slug)
}

export async function loadHubBundle(slug: string): Promise<HubBundle> {
  const root = hubRoot(slug)
  const manifestRaw = await readFile(path.join(root, 'manifest.json'), 'utf-8')
  const manifest = JSON.parse(manifestRaw) as HubManifest
  if (manifest.slug !== slug) {
    throw new Error(`manifest.slug (${manifest.slug}) !== arg (${slug})`)
  }
  if (!isAudienceSegment(manifest.segment)) {
    throw new Error(`Invalid segment in manifest: ${manifest.segment}`)
  }

  const [articleMarkdown, podcastScriptMarkdown, songLyricsMarkdown] = await Promise.all([
    readFile(path.join(root, 'article.md'), 'utf-8'),
    readFile(path.join(root, 'podcast-script.md'), 'utf-8'),
    readFile(path.join(root, 'song-lyrics.md'), 'utf-8'),
  ])

  const tags = withSegmentTag(
    [
      `blog:${slug}`,
      `hub:${slug}`,
      `wp-link:https://blog.egitim.today/${slug}/`,
      `skill:${manifest.skillTags.join(',')}`,
      ...manifest.wpTags.map((t) => `wp-tag:${t}`),
      ...manifest.wpCategories.map((c) => `wp-cat:${c}`),
    ],
    manifest.segment,
  )

  return {
    manifest,
    articleMarkdown,
    podcastScriptMarkdown,
    songLyricsMarkdown,
    tags,
    platforms: platformsForSegment(manifest.segment),
  }
}

export function hubSlugFromArgv(argv = process.argv): string {
  const arg = argv.find((a) => a.startsWith('--slug='))
  if (arg) return arg.slice('--slug='.length)
  const pos = argv[2]
  if (pos && !pos.startsWith('-')) return pos
  throw new Error('Usage: publish-hub-article.ts --slug=karar-verme-hedef-belirleme-esenlik-dongusu')
}
