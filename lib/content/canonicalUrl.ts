import type { SocialPlatform } from '@prisma/client'
import { brandCta } from '@content-studio/core/auth'
import { PLATFORM_FORMATS } from '@content-studio/core/platforms/formats'

const WP_LINK = 'wp-link:'
const BLOG_SLUG = 'blog:'
const LEARNCON_BLOG = 'https://www.egitim.today/blog/'

/**
 * Canonical public URL for SM copy.
 * WP ingest uses `wp-link:`; LearnCon discovery uses `blog:{slug}`.
 * Never invent LearnCon `/blog/` for a WordPress source.
 */
export function canonicalArticleUrl(tags: string[] | undefined | null): string | undefined {
  if (!tags?.length) return undefined
  const wp = tags.find((t) => t.startsWith(WP_LINK))
  if (wp) {
    const url = wp.slice(WP_LINK.length).trim()
    return url || undefined
  }
  const blog = tags.find((t) => t.startsWith(BLOG_SLUG))
  if (blog) {
    const slug = blog.slice(BLOG_SLUG.length).trim().replace(/^\/+|\/+$/g, '')
    if (!slug || slug.includes('://')) return undefined
    return `${LEARNCON_BLOG}${slug}`
  }
  return undefined
}

export function shareCtaBlock(articleUrl?: string): string {
  const brand = brandCta()
  if (!articleUrl) return brand
  return `${brand}\nYazı: ${articleUrl}`
}

/**
 * Append the product CTA and the canonical article line.
 * X keeps the hook inside 280 and stores the article URL on the next line.
 * Publish moves that line into the first reply so the main post has no link.
 */
export function withShareCta(
  text: string,
  articleUrl: string | undefined,
  platform: SocialPlatform,
): string {
  const body = (text ?? '').trim()
  const max = PLATFORM_FORMATS[platform].maxChars
  if (platform === 'TWITTER') {
    const head = body.length <= max ? body : `${body.slice(0, Math.max(0, max - 1)).trim()}…`
    if (!articleUrl) return head
    return `${head}\nYazı: ${articleUrl}`
  }
  const suffix = shareCtaBlock(articleUrl)
  const room = Math.max(0, max - suffix.length)
  const head = body.length <= room ? body : `${body.slice(0, Math.max(0, room - 1)).trim()}…`
  const out = `${head}${suffix}`
  return out.length <= max ? out : out.slice(0, max)
}

export function youtubeDescriptionFooter(articleUrl?: string): string {
  const brand = '\n\n🔗 egitim.today | LEARNCONNECT.NET'
  if (!articleUrl) return brand
  return `${brand}\nYazı: ${articleUrl}`
}
