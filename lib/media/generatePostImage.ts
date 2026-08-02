import React from 'react'
import { ImageResponse } from 'next/og'
import { prisma } from '../prisma'
import type { Prisma } from '@prisma/client'
import { extractPostImageDesign, type PostImageDesign } from './postImageDesign'
import { publicMediaImageUrl, writeImageFile, readImageFile } from './imageStorage'
import { getImageSpec, pickImageSpecKey, type ImageSpec } from '../image/platformSizes'

export { getMediaFile, listMedia } from './mediaDb'

/** Scale every hand-tuned pixel value against the 1200x630 baseline so square/portrait
 * platform sizes (Instagram 1:1, Pinterest 2:3, etc.) don't inherit landscape-only spacing. */
function scaleFactor(spec: ImageSpec): number {
  const raw = Math.min(spec.width, spec.height) / 630
  return Math.max(0.62, Math.min(raw, 1.85))
}

/** Brand watermark — LEARNCONNECT.NET / egitim.today lockup, used on every generated post image. */
function BrandWatermark({ scale, align = 'end' }: { scale: number; align?: 'start' | 'end' }) {
  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        right: align === 'end' ? 44 * scale : undefined,
        left: align === 'start' ? 44 * scale : undefined,
        bottom: 40 * scale,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'end' ? 'flex-end' : 'flex-start',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          fontSize: 13 * scale,
          fontWeight: 700,
          letterSpacing: 3,
          color: '#94a3b8',
          textTransform: 'uppercase',
        },
      },
      'LEARNCONNECT.NET',
    ),
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 } },
      React.createElement(
        'div',
        {
          style: {
            fontSize: 27 * scale,
            fontWeight: 800,
            color: '#0f172a',
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: -0.5,
          },
        },
        'egitim.today',
      ),
      React.createElement('div', {
        style: {
          width: 10 * scale,
          height: 10 * scale,
          borderRadius: 999,
          background: '#22c55e',
        },
      }),
    ),
  )
}

function PostCard({ design, spec }: { design: PostImageDesign; spec: ImageSpec }) {
  const s = scaleFactor(spec)
  const outerPad = Math.round(56 * s)
  const innerPadX = Math.round(64 * s)
  const innerPadY = Math.round(56 * s)
  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${design.accent} 0%, #0f172a 72%)`,
        padding: outerPad,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.96)',
          borderRadius: 28,
          padding: `${innerPadY}px ${innerPadX}px`,
          paddingBottom: Math.round(100 * s),
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        },
      },
      React.createElement(
        'div',
        { style: { fontSize: Math.round(22 * s), fontWeight: 600, color: design.accent, marginBottom: Math.round(20 * s) } },
        `#${design.tag}`,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: Math.round(50 * s),
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.12,
            maxHeight: Math.round(220 * s),
          },
        },
        design.headline,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: Math.round(28 * s),
            color: '#475569',
            marginTop: Math.round(28 * s),
            lineHeight: 1.35,
            maxHeight: Math.round(120 * s),
          },
        },
        design.subtitle,
      ),
      React.createElement(BrandWatermark, { scale: s, align: 'end' }),
    ),
  )
}

async function designToPng(design: PostImageDesign, spec: ImageSpec): Promise<Buffer> {
  const res = new ImageResponse(React.createElement(PostCard, { design, spec }), {
    width: spec.width,
    height: spec.height,
  })
  return Buffer.from(await res.arrayBuffer())
}

/** Generate branded PNG card for SOCIAL_CAPTION (reuses existing IMAGE media). */
export async function generatePostImage(derivedContentId: string) {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: {
      source: true,
      mediaFiles: {
        where: { mediaType: 'IMAGE', processingStatus: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!derived) throw new Error('Derived content not found')
  if (derived.contentType !== 'SOCIAL_CAPTION') {
    throw new Error('Sadece SOCIAL_CAPTION için görsel üretilebilir')
  }

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  const partIndex = typeof meta.partIndex === 'number' ? meta.partIndex : 1
  if (partIndex > 1 && typeof meta.seriesId === 'string') {
    const lead = await prisma.derivedContent.findFirst({
      where: {
        sourceId: derived.sourceId,
        contentType: 'SOCIAL_CAPTION',
        metadata: { path: ['seriesId'], equals: meta.seriesId },
        AND: { metadata: { path: ['partIndex'], equals: 1 } },
      },
      include: {
        mediaFiles: {
          where: { mediaType: 'IMAGE', processingStatus: 'COMPLETED' },
          take: 1,
        },
      },
    })
    const leadUrl =
      lead?.mediaFiles[0]?.fileUrl ||
      (lead?.metadata && typeof lead.metadata === 'object'
        ? (lead.metadata as Record<string, unknown>).imageUrl
        : undefined)
    if (typeof leadUrl === 'string' && leadUrl) {
      if (lead?.mediaFiles[0]) {
        return { media: lead.mediaFiles[0], reused: true, publicUrl: leadUrl }
      }
      await prisma.derivedContent.update({
        where: { id: derivedContentId },
        data: {
          metadata: {
            ...meta,
            imageUrl: leadUrl,
          } as Prisma.InputJsonValue,
        },
      })
      return { media: null, reused: true, publicUrl: leadUrl }
    }
  }

  const articleTitle =
    typeof meta.articleTitle === 'string' && meta.articleTitle.trim()
      ? meta.articleTitle.trim()
      : derived.source.title

  const existing = derived.mediaFiles[0]
  if (existing) {
    return {
      media: existing,
      reused: true,
      publicUrl: publicMediaImageUrl(existing.id),
    }
  }

  const targetPlatform = typeof meta.platform === 'string' ? meta.platform : null
  const specKey = pickImageSpecKey(targetPlatform)
  const spec = getImageSpec(specKey)

  const design = await extractPostImageDesign(articleTitle, derived.content)
  const png = await designToPng(design, spec)

  const media = await prisma.mediaFile.create({
    data: {
      derivedContentId,
      mediaType: 'IMAGE',
      fileUrl: '',
      format: 'png',
      processingStatus: 'PROCESSING',
    },
  })

  try {
    await writeImageFile(`${media.id}.png`, png)
    const publicUrl = publicMediaImageUrl(media.id)
    const updated = await prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        fileUrl: publicUrl,
        fileSize: png.length,
        processingStatus: 'COMPLETED',
      },
    })

    const meta =
      derived.metadata && typeof derived.metadata === 'object'
        ? { ...(derived.metadata as Record<string, unknown>) }
        : {}
    meta.imageUrl = publicUrl
    meta.generatedMediaId = media.id
    meta.imageDesign = design
    meta.imageSpecKey = specKey
    meta.imageWidth = spec.width
    meta.imageHeight = spec.height

    await prisma.derivedContent.update({
      where: { id: derivedContentId },
      data: { metadata: meta as Prisma.InputJsonValue },
    })

    return { media: updated, reused: false, publicUrl, design }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.mediaFile.update({
      where: { id: media.id },
      data: { processingStatus: 'FAILED' },
    })
    throw new Error(message)
  }
}

/** Read PNG bytes for LinkedIn upload (avoids localhost fetch issues). */
export async function readPostImageBuffer(derivedContentId: string): Promise<Buffer | null> {
  const row = await prisma.mediaFile.findFirst({
    where: {
      derivedContentId,
      mediaType: 'IMAGE',
      processingStatus: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) return null
  try {
    return await readImageFile(`${row.id}.png`)
  } catch {
    return null
  }
}
