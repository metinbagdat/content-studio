import React from 'react'
import { ImageResponse } from 'next/og'
import { prisma } from '../prisma'
import type { Prisma } from '@prisma/client'
import { persistGeneratedImage } from './imageStorage'
import { getImageSpec } from '../image/platformSizes'

export type CarouselSlide = {
  title: string
  body: string
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

/** Fallback parser for carousel drafts generated before slides were stored in metadata. */
export function parseCarouselSlidesFromContent(content: string): CarouselSlide[] {
  const chunks = String(content || '').split(/\n\n---\n\n/)
  const slides: CarouselSlide[] = []
  for (const chunk of chunks) {
    const match = chunk.match(/^Slide \d+\/\d+\s*\n\*\*(.+?)\*\*\s*\n([\s\S]*)$/)
    if (!match) continue
    slides.push({ title: clean(match[1], 80), body: clean(match[2], 220) })
  }
  return slides
}

export function resolveCarouselSlides(meta: Record<string, unknown>, content: string): CarouselSlide[] {
  const raw = Array.isArray(meta.slides) ? meta.slides : []
  const fromMeta: CarouselSlide[] = raw
    .map((s) => {
      if (!s || typeof s !== 'object') return null
      const row = s as Record<string, unknown>
      return { title: clean(row.title, 80), body: clean(row.body, 220) }
    })
    .filter((s): s is CarouselSlide => Boolean(s && s.title))
  if (fromMeta.length) return fromMeta
  return parseCarouselSlidesFromContent(content)
}

function SlideCard({
  slide,
  index,
  total,
  accent,
}: {
  slide: CarouselSlide
  index: number
  total: number
  accent: string
}) {
  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(160deg, ${accent} 0%, #0f172a 60%)`,
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
          background: 'rgba(255,255,255,0.97)',
          borderRadius: 28,
          padding: '56px 52px',
          boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            fontSize: 20,
            fontWeight: 700,
            color: accent,
            letterSpacing: 1.5,
            marginBottom: 20,
          },
        },
        `${index + 1} / ${total}`,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1.2,
            color: '#0f172a',
            marginBottom: 24,
          },
        },
        slide.title,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: 26,
            color: '#334155',
            lineHeight: 1.45,
          },
        },
        slide.body,
      ),
      React.createElement(
        'div',
        {
          style: {
            marginTop: 32,
            fontSize: 22,
            fontWeight: 800,
            color: accent,
            fontFamily: 'Georgia, "Times New Roman", serif',
          },
        },
        'egitim.today',
      ),
    ),
  )
}

async function slideToPng(slide: CarouselSlide, index: number, total: number, accent: string): Promise<Buffer> {
  const spec = getImageSpec('instagramPost') // 1080x1080 — square works for LinkedIn document/carousel posts
  const res = new ImageResponse(
    React.createElement(SlideCard, { slide, index, total, accent }),
    { width: spec.width, height: spec.height },
  )
  return Buffer.from(await res.arrayBuffer())
}

export type RenderedCarouselSlide = { buffer: Buffer; index: number }

/**
 * Render slides straight to in-memory PNG buffers — no disk write, no
 * publicMediaImageUrl round trip. Use this at publish time: Vercel's /tmp is
 * ephemeral and not reliably readable back via a self-fetch HTTP request
 * (this already causes 404s for existing SOCIAL_CAPTION/INFOGRAPHIC image
 * posts in production), so anything that needs the bytes *right now* should
 * render them directly rather than write-then-refetch.
 */
export async function renderCarouselSlideBuffers(derivedContentId: string): Promise<RenderedCarouselSlide[]> {
  const derived = await prisma.derivedContent.findUnique({ where: { id: derivedContentId } })
  if (!derived) throw new Error('Derived content not found')
  if (derived.contentType !== 'LINKEDIN_CAROUSEL') {
    throw new Error('Sadece LINKEDIN_CAROUSEL için carousel görselleri üretilebilir')
  }
  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}
  const slides = resolveCarouselSlides(meta, typeof derived.content === 'string' ? derived.content : '')
  if (!slides.length) throw new Error('Carousel slide verisi bulunamadı')

  const headline = slides[0]?.title || derived.title
  const accent = ACCENTS[hashString(headline) % ACCENTS.length]

  const out: RenderedCarouselSlide[] = []
  for (let i = 0; i < slides.length; i++) {
    out.push({ buffer: await slideToPng(slides[i], i, slides.length, accent), index: i })
  }
  return out
}

/**
 * Render every LINKEDIN_CAROUSEL slide as its own branded PNG (no DALL-E —
 * next/og, same approach as generateInfographicImage.ts). Idempotent: reuses
 * previously generated slide URLs from metadata if present.
 */
export async function generateLinkedInCarouselImages(derivedContentId: string) {
  const derived = await prisma.derivedContent.findUnique({ where: { id: derivedContentId } })
  if (!derived) throw new Error('Derived content not found')
  if (derived.contentType !== 'LINKEDIN_CAROUSEL') {
    throw new Error('Sadece LINKEDIN_CAROUSEL için carousel görselleri üretilebilir')
  }

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  const existingUrls = Array.isArray(meta.slideImageUrls) ? (meta.slideImageUrls as string[]) : []
  if (existingUrls.length) {
    return { slideImageUrls: existingUrls, reused: true }
  }

  const slides = resolveCarouselSlides(meta, typeof derived.content === 'string' ? derived.content : '')
  if (!slides.length) throw new Error('Carousel slide verisi bulunamadı')

  const headline = slides[0]?.title || derived.title
  const accent = ACCENTS[hashString(headline) % ACCENTS.length]

  const slideImageUrls: string[] = []
  const mediaIds: string[] = []

  for (let i = 0; i < slides.length; i++) {
    const png = await slideToPng(slides[i], i, slides.length, accent)
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
      const publicUrl = await persistGeneratedImage(media.id, png, 'png')
      await prisma.mediaFile.update({
        where: { id: media.id },
        data: { fileUrl: publicUrl, fileSize: png.length, processingStatus: 'COMPLETED' },
      })
      slideImageUrls.push(publicUrl)
      mediaIds.push(media.id)
    } catch (err) {
      await prisma.mediaFile.update({ where: { id: media.id }, data: { processingStatus: 'FAILED' } })
      throw err
    }
  }

  await prisma.derivedContent.update({
    where: { id: derivedContentId },
    data: {
      metadata: { ...meta, slideImageUrls, slideMediaIds: mediaIds } as Prisma.InputJsonValue,
    },
  })

  return { slideImageUrls, reused: false }
}

/** Read already-generated slide image URLs without triggering generation. */
export async function readCarouselSlideImageUrls(derivedContentId: string): Promise<string[]> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    select: { metadata: true },
  })
  const meta =
    derived?.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}
  return Array.isArray(meta.slideImageUrls) ? (meta.slideImageUrls as string[]) : []
}