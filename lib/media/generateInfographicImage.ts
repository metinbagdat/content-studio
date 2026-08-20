import React from 'react'
import { ImageResponse } from 'next/og'
import { prisma } from '../prisma'
import type { Prisma } from '@prisma/client'
import { publicMediaImageUrl, writeImageFile } from './imageStorage'
import { getImageSpec } from '../image/platformSizes'

export type InfographicPoint = {
  label: string
  stat: string
  detail: string
}

export type InfographicDesign = {
  headline: string
  subhead: string
  points: InfographicPoint[]
  source: string
  accent: string
}

const ACCENTS = ['#0EA5E9', '#059669', '#4F46E5', '#D97706', '#DC2626', '#7C3AED']

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function clean(s: unknown, max: number): string {
  const text = typeof s === 'string' ? s : s == null ? '' : String(s)
  return text.replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Parse `# headline` + `1. label — stat` markdown produced by generateInfographicText. */
export function parseInfographicFromMarkdown(content: string): {
  headline: string
  subhead: string
  points: InfographicPoint[]
  source: string
} {
  const lines = String(content || '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let headline = 'egitim.today'
  let subhead = ''
  let source = 'egitim.today'
  const points: InfographicPoint[] = []

  for (const line of lines) {
    if (line.startsWith('# ')) {
      headline = clean(line.slice(2), 80)
      continue
    }
    if (/^kaynak:/i.test(line)) {
      source = clean(line.replace(/^kaynak:\s*/i, ''), 40) || source
      continue
    }
    const numbered = line.match(/^(\d+)\.\s+(.+?)(?:\s+[—–-]\s+(.+))?$/)
    if (numbered) {
      points.push({
        label: clean(numbered[2], 60),
        stat: clean(numbered[3] || '', 24),
        detail: '',
      })
      continue
    }
    if (/^\d+\./.test(line) === false && points.length === 0 && !subhead && !line.startsWith('#')) {
      subhead = clean(line, 120)
      continue
    }
    if (points.length && !points[points.length - 1].detail && !/^\d+\./.test(line)) {
      points[points.length - 1].detail = clean(line, 100)
    }
  }

  return { headline, subhead, points: points.slice(0, 5), source }
}

export function resolveInfographicDesign(meta: Record<string, unknown>, content: string): InfographicDesign {
  const fromMd = parseInfographicFromMarkdown(content)
  const rawPoints = Array.isArray(meta.points) ? meta.points : fromMd.points
  const points: InfographicPoint[] = rawPoints
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const row = p as Record<string, unknown>
      return {
        label: clean(row.label, 60),
        stat: clean(row.stat, 24),
        detail: clean(row.detail, 100),
      }
    })
    .filter((p): p is InfographicPoint => Boolean(p && p.label))
    .slice(0, 5)

  while (points.length < 5 && fromMd.points[points.length]) {
    points.push(fromMd.points[points.length])
  }

  const headline = clean(meta.headline, 80) || fromMd.headline
  const subhead = clean(meta.subhead, 120) || fromMd.subhead
  const source = clean(meta.source, 40) || fromMd.source
  const accent = ACCENTS[hashString(headline + subhead) % ACCENTS.length]

  return {
    headline: headline || 'egitim.today',
    subhead: subhead || '5 net madde',
    points,
    source: source || 'egitim.today',
    accent,
  }
}

function InfographicCard({ design }: { design: InfographicDesign }) {
  const points = design.points.slice(0, 5)
  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(160deg, ${design.accent} 0%, #0f172a 55%)`,
        padding: 48,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        color: '#0f172a',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.97)',
          borderRadius: 28,
          padding: '40px 44px 36px',
          boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            fontSize: 18,
            fontWeight: 700,
            color: design.accent,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 12,
          },
        },
        '5 NOKTA',
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: 42,
            fontWeight: 800,
            lineHeight: 1.15,
            color: '#0f172a',
            marginBottom: 10,
          },
        },
        design.headline,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: 22,
            color: '#475569',
            marginBottom: 28,
            lineHeight: 1.35,
          },
        },
        design.subhead,
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            flex: 1,
          },
        },
        ...points.map((point, idx) =>
          React.createElement(
            'div',
            {
              key: idx,
              style: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 16,
                padding: '12px 14px',
                borderRadius: 16,
                background: idx % 2 === 0 ? '#f8fafc' : '#f1f5f9',
              },
            },
            React.createElement(
              'div',
              {
                style: {
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: design.accent,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                },
              },
              String(idx + 1),
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', flexDirection: 'column', flex: 1, gap: 4 } },
              React.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 10,
                  },
                },
                React.createElement(
                  'div',
                  { style: { fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 } },
                  point.label,
                ),
                point.stat
                  ? React.createElement(
                      'div',
                      {
                        style: {
                          fontSize: 20,
                          fontWeight: 800,
                          color: design.accent,
                        },
                      },
                      point.stat,
                    )
                  : null,
              ),
              point.detail
                ? React.createElement(
                    'div',
                    { style: { fontSize: 18, color: '#64748b', lineHeight: 1.35 } },
                    point.detail,
                  )
                : null,
            ),
          ),
        ),
      ),
      React.createElement(
        'div',
        {
          style: {
            marginTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
        },
        React.createElement(
          'div',
          { style: { fontSize: 16, color: '#94a3b8' } },
          `Kaynak: ${design.source}`,
        ),
        React.createElement(
          'div',
          {
            style: {
              fontSize: 22,
              fontWeight: 800,
              color: '#0f172a',
              fontFamily: 'Georgia, "Times New Roman", serif',
            },
          },
          'egitim.today',
        ),
      ),
    ),
  )
}

async function designToPng(design: InfographicDesign): Promise<Buffer> {
  const spec = getImageSpec('instagramPost')
  const res = new ImageResponse(React.createElement(InfographicCard, { design }), {
    width: spec.width,
    height: spec.height,
  })
  return Buffer.from(await res.arrayBuffer())
}

/** Render INFOGRAPHIC_TEXT as a 5-point branded PNG (no DALL-E — next/og). */
export async function generateInfographicImage(derivedContentId: string) {
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
  if (derived.contentType !== 'INFOGRAPHIC_TEXT') {
    throw new Error('Sadece INFOGRAPHIC_TEXT için infografik görsel üretilebilir')
  }

  const existing = derived.mediaFiles[0]
  if (existing) {
    return {
      media: existing,
      reused: true,
      publicUrl: publicMediaImageUrl(existing.id),
    }
  }

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  const design = resolveInfographicDesign(meta, typeof derived.content === 'string' ? derived.content : '')
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

    await prisma.derivedContent.update({
      where: { id: derivedContentId },
      data: {
        metadata: {
          ...meta,
          imageUrl: publicUrl,
          generatedMediaId: media.id,
          infographicDesign: design,
          imageSpecKey: 'instagramPost',
          imageWidth: 1080,
          imageHeight: 1080,
        } as Prisma.InputJsonValue,
      },
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
