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

/** Append product CTA + canonical article line, keeping the URL inside the platform limit. */
export function withShareCta(
  text: string,
  articleUrl: string | undefined,
  platform: SocialPlatform,
): string {
  const suffix = shareCtaBlock(articleUrl)
  const max = PLATFORM_FORMATS[platform].maxChars
  const room = Math.max(0, max - suffix.length)
  const body = (text ?? '').trim()
  const head = body.length <= room ? body : `${body.slice(0, Math.max(0, room - 1)).trim()}…`
  const out = `${head}${suffix}`
  return out.length <= max ? out : out.slice(0, max)
}

export function youtubeDescriptionFooter(articleUrl?: string): string {
  const brand = '\n\n🔗 egitim.today | LEARNCONNECT.NET'
  if (!articleUrl) return brand
  return `${brand}\nYazı: ${articleUrl}`
}
