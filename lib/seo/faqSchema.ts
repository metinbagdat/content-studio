/**
 * Detect Q&A / SSS sections and emit FAQPage JSON-LD.
 * Rank Math keeps Article as the base schema; FAQPage is additive (free tier).
 * Injecting JSON-LD in content avoids corrupting Rank Math's internal schema meta.
 */

export type FaqPair = { question: string; answer: string }

const MIN_PAIRS = 2
const MAX_PAIRS = 12
const MAX_ANSWER_CHARS = 5000

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeQuestion(q: string): string {
  return q.replace(/\s+/g, ' ').trim().replace(/^[\d.)\-\s]+/, '')
}

function looksLikeQuestion(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 200) return false
  if (t.includes('?') || t.includes('？')) return true
  return /^(neden|nasıl|ne zaman|ne kadar|kaç|kim|hangi|mı\b|mi\b|mu\b|mü\b|var mı|yok mu)/i.test(
    t,
  )
}

/** Heading-based Q&A: each ? heading + following body until next heading. */
function extractFromHeadings(content: string): FaqPair[] {
  const pairs: FaqPair[] = []
  const headingRe = /<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi
  const matches: Array<{ q: string; start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(content)) !== null) {
    const q = normalizeQuestion(stripTags(m[2]))
    if (!looksLikeQuestion(q)) continue
    matches.push({ q, start: m.index, end: m.index + m[0].length })
  }
  for (let i = 0; i < matches.length; i++) {
    const bodyStart = matches[i].end
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].start : content.length
    const answer = stripTags(content.slice(bodyStart, bodyEnd)).slice(0, MAX_ANSWER_CHARS)
    if (answer.length < 20) continue
    pairs.push({ question: matches[i].q, answer })
  }
  return pairs
}

/** Markdown ## / ### question headings. */
function extractFromMarkdownHeadings(content: string): FaqPair[] {
  if (/<h[2-4][\s>]/i.test(content)) return []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const pairs: FaqPair[] = []
  let i = 0
  while (i < lines.length) {
    const hm = lines[i].match(/^#{2,4}\s+(.+)$/)
    if (!hm || !looksLikeQuestion(hm[1])) {
      i += 1
      continue
    }
    const question = normalizeQuestion(hm[1])
    i += 1
    const body: string[] = []
    while (i < lines.length && !/^#{1,4}\s+/.test(lines[i])) {
      body.push(lines[i])
      i += 1
    }
    const answer = body.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER_CHARS)
    if (answer.length >= 20) pairs.push({ question, answer })
  }
  return pairs
}

/** Explicit Soru / Cevap labels (TR + EN). */
function extractLabeledPairs(content: string): FaqPair[] {
  const plain = content.includes('<') ? stripTags(content) : content.replace(/\s+/g, ' ')
  const re =
    /(?:^|[\n.])\s*(?:soru|s\.?|q|question)\s*[:：.]\s*(.+?)\s*(?:cevap|c\.?|a|answer)\s*[:：.]\s*(.+?)(?=(?:(?:soru|s\.?|q|question)\s*[:：.])|$)/gi
  const pairs: FaqPair[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(plain)) !== null) {
    const question = normalizeQuestion(m[1])
    const answer = m[2].replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER_CHARS)
    if (looksLikeQuestion(question) || question.length >= 12) {
      if (answer.length >= 20) pairs.push({ question, answer })
    }
  }
  return pairs
}

export function extractFaqPairs(content: string): FaqPair[] {
  const fromHtml = extractFromHeadings(content)
  if (fromHtml.length >= MIN_PAIRS) return fromHtml.slice(0, MAX_PAIRS)
  const fromMd = extractFromMarkdownHeadings(content)
  if (fromMd.length >= MIN_PAIRS) return fromMd.slice(0, MAX_PAIRS)
  const labeled = extractLabeledPairs(content)
  if (labeled.length >= MIN_PAIRS) return labeled.slice(0, MAX_PAIRS)
  const merged = [...fromHtml, ...fromMd, ...labeled]
  const seen = new Set<string>()
  const unique: FaqPair[] = []
  for (const p of merged) {
    const key = p.question.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(p)
  }
  return unique.slice(0, MAX_PAIRS)
}

export function titleSuggestsFaq(title: string): boolean {
  const t = title.toLowerCase()
  return (
    t.includes('?') ||
    /\bsss\b|s\.s\.s|sıkça sorulan|faq\b|soru[- ]?cevap/i.test(t) ||
    /ne yapmalı|kaç ay|nasıl hazırlan/i.test(t)
  )
}

export function shouldAttachFaqSchema(title: string, content: string): boolean {
  const pairs = extractFaqPairs(content)
  if (pairs.length >= MIN_PAIRS) return true
  if (pairs.length >= 1 && titleSuggestsFaq(title)) return true
  return false
}

export function buildFaqPageJsonLd(pairs: FaqPair[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((p) => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: p.answer,
      },
    })),
  }
}

export function htmlHasFaqPageJsonLd(html: string): boolean {
  return /"@type"\s*:\s*"FAQPage"/i.test(html) || /@type["']?\s*:\s*["']FAQPage["']/i.test(html)
}

/** Append FAQPage JSON-LD when content looks like Q&A; leave Article schema to Rank Math.
 *  `sourceText` = raw markdown/plain before HTML wrap (preferred for pair extraction). */
export function withFaqSchemaHtml(
  html: string,
  title = '',
  sourceText?: string,
): { html: string; pairs: FaqPair[] } {
  if (!html || htmlHasFaqPageJsonLd(html)) {
    return { html, pairs: [] }
  }
  const extractFrom = sourceText?.trim() ? sourceText : html
  if (!shouldAttachFaqSchema(title, extractFrom) && !shouldAttachFaqSchema(title, html)) {
    return { html, pairs: [] }
  }
  let pairs = extractFaqPairs(extractFrom)
  if (pairs.length < MIN_PAIRS) {
    const fromHtml = extractFaqPairs(html)
    if (fromHtml.length > pairs.length) pairs = fromHtml
  }
  if (!pairs.length) return { html, pairs: [] }
  if (pairs.length < MIN_PAIRS && !titleSuggestsFaq(title)) {
    return { html, pairs: [] }
  }
  const json = JSON.stringify(buildFaqPageJsonLd(pairs.slice(0, MAX_PAIRS)))
  const block = `\n<script type="application/ld+json">${json}</script>\n`
  return { html: `${html.trimEnd()}${block}`, pairs: pairs.slice(0, MAX_PAIRS) }
}
