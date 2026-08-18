import { prisma } from '../prisma'
import { createPipeline } from '../pipeline'
import { isDuplicateArticle } from '../discovery/duplicateDetection'
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

  const existing = await prisma.contentSource.findFirst({
    where: { tags: { has: tag } },
    select: { id: true },
  })
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      sourceId: existing.id,
      pipelineId: null,
      postId,
      message: 'Already ingested',
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
        [tag, 'wp-published', `wp-type:${postType}`, ...(link ? [`wp-link:${link.slice(0, 180)}`] : [])],
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
