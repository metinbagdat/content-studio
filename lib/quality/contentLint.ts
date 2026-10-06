export type ContentLintKind = 'title' | 'body' | 'structure' | 'language'

export type ContentLintIssue = {
  kind: ContentLintKind
  code: string
  message: string
}

export type ContentLintMode = 'article' | 'caption' | 'html'

export type ContentLintInput = {
  title: string
  body: string
  /** article/html: WordPress-style body; caption: social post text */
  mode?: ContentLintMode
}

export type ContentLintResult = {
  ok: boolean
  issues: ContentLintIssue[]
}

const MIN_BODY: Record<ContentLintMode, number> = {
  article: 200,
  html: 200,
  caption: 10,
}

/** Common Turkish spacing / spelling slips — light, deterministic rules only. */
const TR_LANGUAGE_RULES: Array<{ re: RegExp; code: string; message: string }> = [
  {
    re: /\bherşey\b/i,
    code: 'tr_hersey',
    message: 'Yazım: "herşey" → "her şey"',
  },
  {
    re: /\bbirşey\b/i,
    code: 'tr_birsey',
    message: 'Yazım: "birşey" → "bir şey"',
  },
  {
    re: /\bhiçbirşey\b/i,
    code: 'tr_hicbirsey',
    message: 'Yazım: "hiçbirşey" → "hiçbir şey"',
  },
  {
    re: /\bdeğilde\b/i,
    code: 'tr_degilde',
    message: 'Yazım: "değilde" → "değil de"',
  },
  {
    re: /\byapıcak\b/i,
    code: 'tr_yapicak',
    message: 'Yazım: "yapıcak" → "yapacak"',
  },
  {
    re: /\bgeliycek\b/i,
    code: 'tr_geliycek',
    message: 'Yazım: "geliycek" → "gelecek"',
  },
]

const PLACEHOLDER_RE =
  /(?:\blorem ipsum\b|\btodo:|\btbd\b|\[title\]|\[başlık\]|\bplaceholder\b|\bxxx+\b)/i

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function countH1(html: string): number {
  const matches = html.match(/<h1\b[^>]*>/gi)
  return matches?.length ?? 0
}

function firstH1Text(html: string): string | null {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return null
  return stripHtml(m[1])
}

function hasEmptyHeading(html: string): boolean {
  return /<h[1-6]\b[^>]*>\s*<\/h[1-6]>/i.test(html)
}

/** Pure content linter — no DB/network. Fail closed: any issue → ok:false. */
export function lintContent(input: ContentLintInput): ContentLintResult {
  const mode: ContentLintMode = input.mode ?? 'article'
  const title = (input.title || '').trim()
  const bodyRaw = input.body || ''
  const issues: ContentLintIssue[] = []

  if (!title) {
    issues.push({ kind: 'title', code: 'title_empty', message: 'Başlık boş' })
  } else if (title.length < 3) {
    issues.push({ kind: 'title', code: 'title_short', message: 'Başlık çok kısa (min 3 karakter)' })
  } else if (title.length > 200) {
    issues.push({ kind: 'title', code: 'title_long', message: 'Başlık çok uzun (max 200 karakter)' })
  } else if (/^[\s\-_|:]+$/.test(title)) {
    issues.push({ kind: 'title', code: 'title_placeholder', message: 'Başlık yalnızca ayırıcı karakter' })
  }

  if (title && PLACEHOLDER_RE.test(title)) {
    issues.push({
      kind: 'title',
      code: 'title_placeholder_text',
      message: 'Başlıkta yer tutucu metin var (lorem/TODO/[title])',
    })
  }

  const plain =
    mode === 'caption' || !/[<>]/.test(bodyRaw) ? bodyRaw.replace(/\s+/g, ' ').trim() : stripHtml(bodyRaw)
  const minBody = MIN_BODY[mode]

  if (!plain) {
    issues.push({ kind: 'body', code: 'body_empty', message: 'Gövde boş' })
  } else if (plain.length < minBody) {
    issues.push({
      kind: 'body',
      code: 'body_short',
      message: `Gövde çok kısa (min ${minBody} karakter, şu an ${plain.length})`,
    })
  }

  if (plain && PLACEHOLDER_RE.test(plain)) {
    issues.push({
      kind: 'body',
      code: 'body_placeholder',
      message: 'Gövdede yer tutucu metin var (lorem/TODO/placeholder)',
    })
  }

  if (mode === 'article' || mode === 'html') {
    const h1Count = countH1(bodyRaw)
    if (h1Count > 1) {
      issues.push({
        kind: 'structure',
        code: 'h1_multiple',
        message: `Birden fazla H1 var (${h1Count}) — tek H1 olmalı`,
      })
    }
    const h1Text = firstH1Text(bodyRaw)
    if (title && h1Text && normalizeForCompare(title) === normalizeForCompare(h1Text)) {
      // Duplicate title+H1 is noisy in WP (title already renders as H1 in many themes)
      issues.push({
        kind: 'structure',
        code: 'h1_duplicates_title',
        message: 'H1 başlıkla aynı — gövdede tekrar H1 kullanmayın',
      })
    }
    if (hasEmptyHeading(bodyRaw)) {
      issues.push({
        kind: 'structure',
        code: 'heading_empty',
        message: 'Boş başlık etiketi (H1–H6) var',
      })
    }
  }

  const linkProbe = mode === 'caption' ? bodyRaw : `${title}\n${plain}\n${bodyRaw}`
  if (/\[[^\]]*\]\(\s*\)/.test(linkProbe) || /\[[^\]]+$/.test(bodyRaw.trim())) {
    issues.push({
      kind: 'structure',
      code: 'link_broken',
      message: 'Bozuk markdown linki var ([metin]() veya kapanmamış [)',
    })
  }

  const languageProbe = `${title}\n${plain}`
  for (const rule of TR_LANGUAGE_RULES) {
    if (rule.re.test(languageProbe)) {
      issues.push({ kind: 'language', code: rule.code, message: rule.message })
    }
  }

  return { ok: issues.length === 0, issues }
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Single Turkish summary for API / review-fault / post.error. */
export function formatContentLintFailure(result: ContentLintResult): string {
  if (result.ok) return ''
  const parts = result.issues.map((i) => i.message)
  return `İçerik linter: ${parts.join('; ')}`
}

/** Throws Error with formatted message when lint fails — use on publish paths. */
export function assertContentLintPasses(input: ContentLintInput): ContentLintResult {
  const result = lintContent(input)
  if (!result.ok) {
    throw new Error(formatContentLintFailure(result))
  }
  return result
}
