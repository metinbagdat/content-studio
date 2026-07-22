export type FetchedBlog = {
  slug: string
  title: string
  excerpt: string
  contentMarkdown: string
  tags: string[]
  url: string
}

function stripSiteSuffix(title: string): string {
  return title
    .replace(/\s*[|—–-]\s*egitim\.today.*$/i, '')
    .replace(/\s*[|—–-]\s*LearnConnect.*$/i, '')
    .trim()
}

function decodeHtml(s: string): string {
  return s
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Fetch blog article from egitim.today (meta + article HTML in SSR payload). */
export async function fetchEgitimTodayBlog(slug: string): Promise<FetchedBlog> {
  const url = `https://www.egitim.today/blog/${slug}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ContentStudio/1.0 (+https://egitim.today)' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Blog fetch ${res.status}: ${url}`)
  const html = await res.text()

  const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1]
  const jsonTitle = html.match(/"headline":"([^"]+)"/)?.[1]
  const h1 = html.match(/<article[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  const title = stripSiteSuffix(decodeHtml(ogTitle || jsonTitle || stripTags(h1 || '') || slug))

  const excerpt = decodeHtml(
    html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ||
      html.match(/"description":"([^"]+)"/)?.[1] ||
      '',
  )

  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i)
  const articleHtml = articleMatch?.[0] || html

  const sections: string[] = []
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>\s*([\s\S]*?)(?=<h2|$)/gi
  let m: RegExpExecArray | null
  while ((m = h2Re.exec(articleHtml))) {
    const heading = stripTags(m[1])
    const block = m[2]
    const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((p) => stripTags(p[1]))
      .filter((p) => p.length > 20)
    if (heading && paragraphs.length) {
      sections.push(`## ${heading}\n\n${paragraphs.join('\n\n')}`)
    }
  }

  if (!sections.length) {
    const paras = [...articleHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((p) => stripTags(p[1]))
      .filter((p) => p.length > 40)
    sections.push(...paras.map((p) => p))
  }

  const contentMarkdown = sections.join('\n\n').trim()
  if (!contentMarkdown) throw new Error(`Blog içeriği parse edilemedi: ${url}`)

  const tags = new Set<string>(['egitim.today', `blog:${slug}`])
  for (const tag of html.matchAll(/property="article:tag"\s+content="([^"]+)"/gi)) {
    if (tag[1]) tags.add(tag[1])
  }

  return { slug, title, excerpt, contentMarkdown, tags: [...tags], url }
}
