/**
 * Title / slug hygiene for WordPress drafts.
 *
 * Root cause of `blog_post-…` slugs on blog.egitim.today: `generateTransform()` used to
 * return titles like `BLOG_POST: <source title>` and the WP payload was sent without a
 * `slug`, so WordPress derived `post_name` from the prefixed title
 * (`sanitize_title('BLOG_POST: X')` → `blog_post-x`). These helpers strip the internal
 * content-type label and always send an explicit, clean slug.
 */

const CONTENT_TYPE_LABELS = [
  'BLOG_POST',
  'VIDEO_SCRIPT',
  'SHORT_VIDEO_SCRIPT',
  'PODCAST_SCRIPT',
  'MARCH_LYRICS',
  'SONG_LYRICS',
  'SOCIAL_CAPTION',
  'INFOGRAPHIC_TEXT',
  'TWITTER_THREAD',
]

const TITLE_PREFIX = new RegExp(`^\\s*(?:${CONTENT_TYPE_LABELS.join('|')})\\s*:\\s*`, 'i')
const SLUG_PREFIX = new RegExp(`^(?:${CONTENT_TYPE_LABELS.join('|')})[-_]+`, 'i')

/** `BLOG_POST: YKS çalışma düzeni` → `YKS çalışma düzeni` (repeated labels too). */
export function stripContentTypePrefix(title: string): string {
  let out = String(title || '')
  while (TITLE_PREFIX.test(out)) out = out.replace(TITLE_PREFIX, '')
  return out.trim()
}

const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
}

/** ASCII, hyphenated slug matching WordPress `sanitize_title` for Turkish titles. */
export function slugifyTr(input: string, maxLength = 80): string {
  const ascii = String(input || '')
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (ch) => TR_MAP[ch] || ch)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  let slug = ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (slug.length > maxLength) {
    const cut = slug.slice(0, maxLength)
    const lastDash = cut.lastIndexOf('-')
    slug = (lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut).replace(/-$/, '')
  }
  return slug
}

/**
 * Slug for a WP draft: prefer an explicit SEO slug from metadata, else derive from the
 * (prefix-stripped) title. Never returns a content-type-prefixed slug.
 */
export function wpSlugFor(title: string, seoSlug?: unknown): string {
  const fromSeo = typeof seoSlug === 'string' ? slugifyTr(seoSlug.replace(SLUG_PREFIX, '')) : ''
  if (fromSeo) return fromSeo.replace(SLUG_PREFIX, '')
  return slugifyTr(stripContentTypePrefix(title)).replace(SLUG_PREFIX, '')
}
