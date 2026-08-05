import { createHash } from 'crypto'

export type PostPublishMetrics = {
  publishHash?: string
  imageAttached?: boolean
  imageError?: string
  replaced?: boolean
  previousPlatformPostId?: string
  deletedFromPlatform?: boolean
  deleteError?: string
  updatedAt?: string
  publishingStartedAt?: string
  autopilotRetries?: number
  lastAutopilotRetry?: string
}

export function postContentFingerprint(postContent: string, mediaUrls: string[] = []): string {
  const payload = `${postContent.trim()}\n${mediaUrls.map((u) => u.trim()).join('\n')}`
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

export function readPublishMetrics(metrics: unknown): PostPublishMetrics {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return {}
  return metrics as PostPublishMetrics
}
