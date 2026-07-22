import React from 'react'
import { ImageResponse } from 'next/og'
import { prisma } from '../prisma'
import type { Prisma } from '@prisma/client'
import { extractPostImageDesign, type PostImageDesign } from './postImageDesign'
import { publicMediaImageUrl, writeImageFile, readImageFile } from './imageStorage'

export { getMediaFile, listMedia } from './mediaDb'

function PostCard({ design }: { design: PostImageDesign }) {
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
        padding: 56,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.96)',
          borderRadius: 28,
          padding: '56px 64px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        },
      },
      React.createElement(
        'div',
        { style: { fontSize: 22, fontWeight: 600, color: design.accent, marginBottom: 20 } },
        `#${design.tag}`,
      ),
      React.createElement(
        'div',
        { style: { fontSize: 50, fontWeight: 700, color: '#0f172a', lineHeight: 1.12, maxHeight: 220 } },
        design.headline,
      ),
      React.createElement(
        'div',
        { style: { fontSize: 28, color: '#475569', marginTop: 28, lineHeight: 1.35, maxHeight: 120 } },
        design.subtitle,
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', gap: 20, alignItems: 'baseline', marginTop: 36 } },
        React.createElement(
          'div',
          { style: { fontSize: 28, fontWeight: 700, color: design.accent } },
          'egitim.today',
        ),
        React.createElement(
          'div',
          { style: { fontSize: 22, color: '#64748b' } },
          'Öğren · Büyü · Hedefe ulaş',
        ),
      ),
    ),
  )
}

async function designToPng(design: PostImageDesign): Promise<Buffer> {
  const res = new ImageResponse(React.createElement(PostCard, { design }), {
    width: 1200,
    height: 630,
  })
  return Buffer.from(await res.arrayBuffer())
}

/** Generate branded PNG card for SOCIAL_CAPTION (reuses existing IMAGE media). */
export async function generatePostImage(derivedContentId: string) {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: {
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

  const existing = derived.mediaFiles[0]
  if (existing) {
    return {
      media: existing,
      reused: true,
      publicUrl: publicMediaImageUrl(existing.id),
    }
  }

  const design = await extractPostImageDesign(derived.title, derived.content)
  const png = await designToPng(design)

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
