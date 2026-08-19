import { prisma } from '../prisma'
import { createPipeline } from '../pipeline'
import { isDuplicateArticle, normalizeTitle } from '../discovery/duplicateDetection'
import { detectAudienceSegment, withSegmentTag } from '../audience/segments'

export type WordpressPublishedPayload = {
  post_id?: number | string
  postId?: number | string
  title?: string
  link?: string
  url?: string
  post_type?: string
  content?: string
  excerpt?: string
  meta?: Record<string, unknown>
}

export type IngestPublishedResult = {
  ok: boolean
  duplicate: boolean
  sourceId?: string
  pipelineId?: string | null
  postId: number
  message: string
}

function htmlToText(html: string): string {
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

export function parsePostId(body: WordpressPublishedPayload): number | null {
  const raw = body.post_id ?? body.postId
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function wpPostTag(postId: number): string {
  return `wp-post:${postId}`
}

function wpLinkTag(link: string): string {
  return `wp-link:${link.slice(0, 180)}`
}

async function findExistingSourceForWp(opts: {
  postId: number
  title: string
  link: string
}): Promise<{ id: string; tags: string[] } | null> {
  const byWp = await prisma.contentSource.findFirst({
    where: { tags: { has: wpPostTag(opts.postId) } },
    select: { id: true, tags: true },
  })
  if (byWp) return byWp

  const slug = opts.link.replace(/\/$/, '').split('/').pop() || ''
  if (slug) {
    const byBlog = await prisma.contentSource.findFirst({
      where: { tags: { has: `blog:${slug}` } },
      select: { id: true, tags: true },
    })
    if (byBlog) return byBlog
  }

  const norm = normalizeTitle(opts.title)
  if (!norm) return null
  const recent = await prisma.contentSource.findMany({
    select: { id: true, title: true, tags: true },
    take: 200,
    orderBy: { createdAt: 'desc' },
  })
  const hit = recent.find((s) => normalizeTitle(s.title) === norm)
  return hit ? { id: hit.id, tags: hit.tags } : null
}

function mergeWpTags(existing: string[], postId: number, link: string, postType: string): string[] {
  const extra = [wpPostTag(postId), 'wp-published', `wp-type:${postType}`, ...(link ? [wpLinkTag(link)] : [])]
  return [...new Set([...existing, ...extra])]
}

/** WP publish → SM atomization. Idempotent on post_id (CS-WP-04). */
export async function ingestWordpressPublished(
  body: WordpressPublishedPayload,
  options: { triggerPipeline?: boolean } = {},
): Promise<IngestPublishedResult> {
  const postId = parsePostId(body)
  if (!postId) {
    throw new Error('post_id required')
  }

  const title = String(body.title || '').trim()
  if (!title) throw new Error('title required')

  const link = String(body.link || body.url || '').trim()
  const htmlOrText = String(body.content || body.excerpt || '').trim()
  const content = htmlToText(htmlOrText) || `${title}\n${link}`.trim()
  const postType = String(body.post_type || 'article')
  const tag = wpPostTag(postId)
  const triggerPipeline = options.triggerPipeline !== false

  const existing = await findExistingSourceForWp({ postId, title, link })
  if (existing) {
    const alreadyWp = existing.tags.includes(tag)
    const tags = mergeWpTags(existing.tags, postId, link, postType)
    if (tags.join('\0') !== existing.tags.join('\0')) {
      await prisma.contentSource.update({ where: { id: existing.id }, data: { tags } })
    }
    let pipelineId: string | null = null
    if (!alreadyWp && triggerPipeline) {
      const pipeline = await createPipeline(existing.id, { includeMarchSong: true })
      pipelineId = pipeline.id
    }
    return {
      ok: true,
      duplicate: alreadyWp,
      sourceId: existing.id,
      pipelineId,
      postId,
      message: alreadyWp ? 'Already ingested' : 'Attached WP canonical URL to existing source',
    }
  }

  if (await isDuplicateArticle(`wp-${postId}`, title, content)) {
    return {
      ok: true,
      duplicate: true,
      postId,
      message: 'Duplicate title/content — skipped',
    }
  }

  const source = await prisma.contentSource.create({
    data: {
      title,
      content,
      category: 'wordpress',
      tags: withSegmentTag(
        [tag, 'wp-published', `wp-type:${postType}`, ...(link ? [wpLinkTag(link)] : [])],
        detectAudienceSegment(`${title}\n${content}`),
      ),
    },
  })

  let pipelineId: string | null = null
  if (triggerPipeline) {
  const pipeline = await createPipeline(source.id, { includeMarchSong: true })
    pipelineId = pipeline.id
  }

  await prisma.queueJob.create({
    data: {
      jobType: 'DISCOVERY_NOTIFICATION',
      status: 'COMPLETED',
      payload: { kind: 'wordpress-published', postId, link, postType },
      result: { sourceId: source.id, pipelineId, duplicate: false },
      startedAt: new Date(),
      completedAt: new Date(),
    },
  })

  return {
    ok: true,
    duplicate: false,
    sourceId: source.id,
    pipelineId,
    postId,
    message: triggerPipeline ? 'Ingested and pipeline queued' : 'Ingested',
  }
}
