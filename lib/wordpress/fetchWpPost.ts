export type WpRestPost = {
  id: number
  slug: string
  link: string
  title: string
  contentHtml: string
  excerpt: string
  status: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeRendered(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'rendered' in value) {
    return String((value as { rendered?: string }).rendered || '')
  }
  return ''
}

function mapPost(raw: Record<string, unknown>): WpRestPost {
  const titleHtml = decodeRendered(raw.title)
  const contentHtml = decodeRendered(raw.content)
  const excerptHtml = decodeRendered(raw.excerpt)
  return {
    id: Number(raw.id),
    slug: String(raw.slug || ''),
    link: String(raw.link || ''),
    title: stripHtml(titleHtml),
    contentHtml,
    excerpt: stripHtml(excerptHtml),
    status: String(raw.status || ''),
  }
}

function wpBase(): string {
  return (process.env.WP_BASE_URL || 'https://blog.egitim.today').replace(/\/$/, '')
}

export async function fetchWpPostBySlug(slug: string): Promise<WpRestPost | null> {
  const url = `${wpBase()}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=publish`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ContentStudio/1.0 (+https://egitim.today)' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`WP REST ${res.status}: ${url}`)
  const rows = (await res.json()) as Record<string, unknown>[]
  if (!rows?.length) return null
  return mapPost(rows[0])
}

export async function fetchWpPublishedPosts(limit = 20): Promise<WpRestPost[]> {
  const url = `${wpBase()}/wp-json/wp/v2/posts?per_page=${Math.min(100, Math.max(1, limit))}&status=publish&orderby=date&order=desc`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ContentStudio/1.0 (+https://egitim.today)' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`WP REST ${res.status}: ${url}`)
  const rows = (await res.json()) as Record<string, unknown>[]
  return (rows || []).map(mapPost)
}

export { stripHtml as wpHtmlToText }
