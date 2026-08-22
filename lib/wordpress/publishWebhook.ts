import { prisma } from '@/lib/prisma'
import {
  ingestWordpressPublished,
  type WordpressPublishedPayload,
} from '@/lib/wordpress/ingestPublished'

function metaYes(meta: Record<string, unknown> | undefined, keys: string[]): boolean {
  if (!meta) return false
  for (const key of keys) {
    if (String(meta[key] ?? '').toLowerCase() === 'yes') return true
  }
  return false
}

/** Decide SM auto-pipeline from WP post meta echoed in webhook payload. */
export function wpPublishReviewFlags(meta?: Record<string, unknown>): {
  triggerPipeline: boolean
  needsReview: boolean
} {
  const isAi = metaYes(meta, ['cs_ai_generated', '_is_ai_generated', '_cs_ai_generated'])
  const samuraiValidated = metaYes(meta, [
    'cs_safe_samurai_validated',
    '_cs_safe_samurai_validated',
  ])
  if (isAi && !samuraiValidated) {
    return { triggerPipeline: false, needsReview: true }
  }
  return { triggerPipeline: true, needsReview: false }
}

export async function handleWordpressPublishWebhook(body: WordpressPublishedPayload) {
  const meta =
    body.meta && typeof body.meta === 'object' ? (body.meta as Record<string, unknown>) : {}
  const { triggerPipeline, needsReview } = wpPublishReviewFlags(meta)

  const result = await ingestWordpressPublished(body, { triggerPipeline })

  if (needsReview && result.sourceId) {
    const source = await prisma.contentSource.findUnique({
      where: { id: result.sourceId },
      select: { tags: true },
    })
    const tags = [...new Set([...(source?.tags || []), 'needs-review:ai-unvalidated'])]
    await prisma.contentSource.update({ where: { id: result.sourceId }, data: { tags } })
    console.warn(
      '[wp-webhook] AI content published without CS Samurai validation, flagged:',
      result.sourceId,
    )
  }

  return { ...result, needsReview }
}
