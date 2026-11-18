/** X post shape: hook in the main tweet, article URL in the first reply. */

const ARTICLE_LINE = /(?:^|\n)\s*Yazı:\s*(https?:\/\/\S+)/i
const BRAND_URL_LINE = /(?:^|\n)\s*→[^\n]*https?:\/\/\S+/g
const URL_RE = /https?:\/\/\S+/g

export type TwitterPostParts = {
  /** Main tweet. No http(s) URL. */
  body: string
  /** First reply, or null when there is nothing to link. */
  replyText: string | null
}

function trimUrl(raw: string): string {
  return raw.replace(/[)\].,;:!?]+$/g, '')
}

function fit(text: string, max = 280): string {
  const clean = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

/**
 * Pull article and brand URLs out of a stored caption.
 * Existing drafts keep `Yazı: <url>` in postContent; publish strips it here.
 */
export function splitTwitterPost(text: string): TwitterPostParts {
  const article = text.match(ARTICLE_LINE)
  const articleUrl = article ? trimUrl(article[1]) : null
  let rest = text.replace(ARTICLE_LINE, ' ').replace(BRAND_URL_LINE, ' ')

  const extra: string[] = []
  rest = rest.replace(URL_RE, (raw) => {
    extra.push(trimUrl(raw))
    return ' '
  })

  const link = articleUrl || extra[0] || null
  const replyText = link ? fit(`Yazı: ${link}`) : null
  return { body: fit(rest), replyText }
}

export type TwitterThreadParts = {
  /** One tweet, or a numbered thread. None of them contain a URL. */
  tweets: string[]
  replyText: string | null
}

/** Numbered blocks (`1/5 …`) become a reply chain. A single caption stays one tweet. */
export function splitTwitterThread(text: string): TwitterThreadParts {
  const { body, replyText } = splitTwitterPost(text)
  const tweets = body
    .split(/\n\n(?=\d+\/\d+\s)/)
    .map((part) => fit(part))
    .filter(Boolean)
  return { tweets, replyText }
}
