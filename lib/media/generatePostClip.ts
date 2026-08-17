import { readFile } from 'fs/promises'
import path from 'path'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { generatePostImage } from './generatePostImage'
import { imageDiskPath } from './imageStorage'
import { aspectFromDimensions, renderKenBurnsClip, socialAnimationEnabled } from './animateImageClip'
import { publicMediaVideoUrl, videoDiskPath, writeVideoFile } from '../video/videoStorage'
import { getImageSpec, pickImageSpecKey } from '../image/platformSizes'

export { socialAnimationEnabled } from './animateImageClip'

/** Branded animated MP4 clip for SOCIAL_CAPTION (Ken Burns on generated PNG). */
export async function generatePostClip(derivedContentId: string) {
  if (!socialAnimationEnabled()) {
    return { media: null, reused: true, publicUrl: null as string | null, skipped: true as const }
  }

  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: {
      mediaFiles: {
        where: { mediaType: 'VIDEO', processingStatus: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!derived) throw new Error('Derived content not found')
  if (derived.contentType !== 'SOCIAL_CAPTION') {
    throw new Error('Sadece SOCIAL_CAPTION için klip üretilebilir')
  }

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  const existingClipUrl = typeof meta.clipUrl === 'string' ? meta.clipUrl.trim() : ''
  const existing = derived.mediaFiles[0]
  if (existing && existingClipUrl.includes('/api/media/') && existingClipUrl.endsWith('/video')) {
    return {
      media: existing,
      reused: true,
      publicUrl: publicMediaVideoUrl(existing.id),
      skipped: false as const,
    }
  }

  const imageResult = await generatePostImage(derivedContentId)
  if (!imageResult.media) {
    throw new Error('Görsel üretilemedi — klip için PNG gerekli')
  }

  const imageId = imageResult.media.id
  const pngPath = imageDiskPath(`${imageId}.png`)
  try {
    await readFile(pngPath)
  } catch {
    throw new Error(`PNG dosyası bulunamadı: ${pngPath}`)
  }

  const targetPlatform = typeof meta.platform === 'string' ? meta.platform : null
  const specKey = pickImageSpecKey(targetPlatform)
  const spec = getImageSpec(specKey)
  const aspect = aspectFromDimensions(spec.width, spec.height)

  const media = await prisma.mediaFile.create({
    data: {
      derivedContentId,
      mediaType: 'VIDEO',
      fileUrl: '',
      format: 'mp4',
      processingStatus: 'PROCESSING',
    },
  })

  const outputPath = videoDiskPath(`${media.id}.mp4`)

  try {
    await renderKenBurnsClip({
      imagePath: pngPath,
      outputPath,
      aspect,
      durationSec: 6,
      caption: String(derived.title || derived.content).replace(/\s+/g, ' ').trim().slice(0, 120),
    })

    const buffer = await readFile(outputPath)
    await writeVideoFile(`${media.id}.mp4`, buffer)
    const publicUrl = publicMediaVideoUrl(media.id)

    const updated = await prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        fileUrl: publicUrl,
        fileSize: buffer.length,
        processingStatus: 'COMPLETED',
        duration: 6,
      },
    })

    const nextMeta = { ...meta, clipUrl: publicUrl, clipMediaId: media.id }
    await prisma.derivedContent.update({
      where: { id: derivedContentId },
      data: { metadata: nextMeta as Prisma.InputJsonValue },
    })

    return { media: updated, reused: false, publicUrl, skipped: false as const }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.mediaFile.update({
      where: { id: media.id },
      data: { processingStatus: 'FAILED' },
    })
    throw new Error(message)
  }
}

export async function readPostClipBuffer(
  derivedContentId: string,
): Promise<{ buffer: Buffer; contentType: string; diskPath: string } | null> {
  const row = await prisma.mediaFile.findFirst({
    where: {
      derivedContentId,
      mediaType: 'VIDEO',
      processingStatus: 'COMPLETED',
      format: 'mp4',
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) return null

  const diskPath = videoDiskPath(`${row.id}.mp4`)
  try {
    const buffer = await readFile(diskPath)
    return { buffer, contentType: 'video/mp4', diskPath }
  } catch {
    return null
  }
}

export function publicClipUrlFromMeta(meta: Record<string, unknown>): string | null {
  const url = typeof meta.clipUrl === 'string' ? meta.clipUrl.trim() : ''
  if (url.startsWith('http')) return url
  const id = typeof meta.clipMediaId === 'string' ? meta.clipMediaId : ''
  if (id) return publicMediaVideoUrl(id)
  return null
}
