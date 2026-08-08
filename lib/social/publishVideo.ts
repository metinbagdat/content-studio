import type { ContentType } from '@prisma/client'
import { prisma } from '../prisma'
import { formatForPlatform } from '../platforms/formats'
import { generateVideoVariants, generateTikTokVideo } from '../video/generateVideo'
import { generatePodcastVideo } from '../video/generatePodcastVideo'
import type { AspectRatio } from '../video/renderVideo'
import { publicMediaVideoUrl, videoDiskPath } from '../video/videoStorage'

export type YouTubeMetadata = {
  title: string
  description: string
  tags: string[]
  isShort: boolean
}

export type ResolvedVideoMedia = {
  mediaId: string
  publicUrl: string
  diskPath: string
  aspect: AspectRatio
}

function readMeta(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
}

function unfenceJson(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

/** Infer 16:9 long-form vs 9:16 Shorts from derivative metadata / content type. */
export function inferVideoAspect(
  contentType: ContentType,
  metadata: unknown,
): AspectRatio {
  const meta = readMeta(metadata)
  const atomKind = String(meta.atomKind || '')
  if (contentType === 'SHORT_VIDEO_SCRIPT' || atomKind === 'youtube_short') return '9:16'
  return '16:9'
}

export function isShortFormVideo(contentType: ContentType, metadata: unknown): boolean {
  return inferVideoAspect(contentType, metadata) === '9:16'
}

/** Build YouTube title/description/tags from script JSON or plain text. */
export function buildYouTubeMetadata(input: {
  title: string
  content: string
  contentType: ContentType
  metadata?: unknown
  sourceTitle?: string
}): YouTubeMetadata {
  const isShort = isShortFormVideo(input.contentType, input.metadata)
  const baseTitle = input.title || input.sourceTitle || 'egitim.today'
  const tags = ['egitim', 'education', 'learnconnect', 'egitimtoday']
  if (isShort) tags.push('Shorts')
  if (input.contentType === 'PODCAST_SCRIPT') tags.push('podcast')

  const raw = unfenceJson(input.content)
  try {
    const data = JSON.parse(raw) as {
      hook?: string
      caption?: string
      callToAction?: string
      welcome?: string
      cta?: string
      segments?: Array<{ title?: string; narration?: string; voice?: string; script?: string; visuals?: string; visual?: string }>
      scenes?: Array<{ title?: string; narration?: string; voice?: string; script?: string; visuals?: string; visual?: string }>
    }
    const hook = data.hook?.trim() || data.welcome?.trim() || ''
    const title = (hook || baseTitle.replace(/^Podcast:\s*/i, '').replace(/^PODCAST_SCRIPT:\s*/i, '')).slice(0, 100)
    const parts: string[] = []
    if (hook) parts.push(hook)
    const segs = data.segments || data.scenes || []
    for (const scene of segs) {
      const line = scene.script || scene.narration || scene.voice
      if (line?.trim()) parts.push(line.trim())
    }
    if (data.callToAction?.trim()) parts.push(data.callToAction.trim())
    if (data.cta?.trim()) parts.push(data.cta.trim())
    if (data.caption?.trim()) parts.push(data.caption.trim())
    parts.push('\n\n🔗 egitim.today | LEARNCONNECT.NET')
    if (isShort) parts.push('\n#Shorts')
    if (input.contentType === 'PODCAST_SCRIPT') parts.push('\n#Podcast')

    return {
      title,
      description: formatForPlatform(parts.join('\n\n'), 'YOUTUBE'),
      tags,
      isShort,
    }
  } catch {
    return {
      title: baseTitle.replace(/^Podcast:\s*/i, '').slice(0, 100),
      description: formatForPlatform(`${raw}\n\n🔗 egitim.today | LEARNCONNECT.NET`, 'YOUTUBE'),
      tags,
      isShort,
    }
  }
}

/** Post body stored on SocialMediaPost — description for YouTube upload. */
export function buildYouTubePostContent(input: {
  title: string
  content: string
  contentType: ContentType
  metadata?: unknown
  sourceTitle?: string
}): string {
  const meta = buildYouTubeMetadata(input)
  return meta.description
}

async function findCompletedVideo(derivedContentId: string, aspect: AspectRatio) {
  const files = await prisma.mediaFile.findMany({
    where: { derivedContentId, mediaType: 'VIDEO', processingStatus: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  })
  if (!files.length) return null

  const derived = await prisma.derivedContent.findUnique({ where: { id: derivedContentId } })
  const meta = readMeta(derived?.metadata)
  const variants =
    (meta.videoVariants as Array<{ mediaId: string; aspect: AspectRatio }> | undefined) ||
    (meta.videoVariantsEn as Array<{ mediaId: string; aspect: AspectRatio }> | undefined)

  if (variants?.length) {
    const match = variants.find((v) => v.aspect === aspect)
    if (match) {
      const file = files.find((f) => f.id === match.mediaId)
      if (file) return file
    }
  }

  return files[0]
}

/** Ensure a watermarked MP4 exists on disk; generate if missing. */
export async function ensureGeneratedVideo(derivedContentId: string): Promise<ResolvedVideoMedia> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { source: true },
  })
  if (!derived) throw new Error('Derived content not found')

  const isPodcast = derived.contentType === 'PODCAST_SCRIPT'
  const isVideoScript = ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'].includes(derived.contentType)
  if (!isVideoScript && !isPodcast) {
    throw new Error(`${derived.contentType} video üretimi desteklenmiyor`)
  }

  const aspect = isPodcast ? '16:9' : inferVideoAspect(derived.contentType, derived.metadata)
  const existing = await findCompletedVideo(derivedContentId, aspect)
  if (existing?.fileUrl) {
    return {
      mediaId: existing.id,
      publicUrl: existing.fileUrl || publicMediaVideoUrl(existing.id),
      diskPath: videoDiskPath(`${existing.id}.mp4`),
      aspect,
    }
  }

  if (isPodcast) {
    const variants = await generatePodcastVideo(derivedContentId, [aspect])
    const variant = variants[0]
    if (!variant) throw new Error('Podcast video üretilemedi')
    return {
      mediaId: variant.mediaId,
      publicUrl: variant.publicUrl,
      diskPath: videoDiskPath(`${variant.mediaId}.mp4`),
      aspect,
    }
  }

  const variants =
    aspect === '9:16'
      ? await generateTikTokVideo(derivedContentId)
      : await generateVideoVariants(derivedContentId, [aspect])

  const variant = variants.find((v) => v.aspect === aspect) || variants[0]
  if (!variant) throw new Error('Video üretilemedi — ffmpeg/provider hatası')

  return {
    mediaId: variant.mediaId,
    publicUrl: variant.publicUrl,
    diskPath: videoDiskPath(`${variant.mediaId}.mp4`),
    aspect,
  }
}

export async function resolveVideoMediaUrls(derivedContentId: string): Promise<string[]> {
  try {
    const video = await ensureGeneratedVideo(derivedContentId)
    return [video.publicUrl]
  } catch (err) {
    console.warn('[resolveVideoMediaUrls]', derivedContentId, err)
    return []
  }
}
