import sharp from 'sharp'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { extractPostImageDesign, type PostImageDesign } from '../media/postImageDesign'
import { persistGeneratedImage } from '../media/imageStorage'
import { getImageSpec, pickImageSpecKey, type ImageSpec, type PlatformImageKey } from './platformSizes'
import { generateWithFallback } from './providers'

const BRAND_STYLE =
  'clean modern flat illustration, minimalist, soft gradient background, ' +
  'educational and optimistic mood, no text, no words, no letters, no watermark'

const ACCENT_HINTS: Record<string, string> = {
  '#4F46E5': 'indigo and violet tones',
  '#0EA5E9': 'sky blue and teal tones',
  '#7C3AED': 'purple and magenta tones',
  '#059669': 'emerald and teal green tones',
  '#D97706': 'amber and warm orange tones',
  '#DC2626': 'red and coral tones',
}

function buildPrompt(design: PostImageDesign): string {
  const colorHint = ACCENT_HINTS[design.accent] || 'brand color palette'
  return [`Illustration about "${design.tag}" — ${design.headline}`, colorHint, BRAND_STYLE].join(', ')
}

/** Scale factor mirrors generatePostImage.ts's own scaleFactor() so the lockup
 * stays visually consistent in size between branded cards and AI images. */
function scaleFactor(spec: ImageSpec): number {
  const raw = Math.min(spec.width, spec.height) / 630
  return Math.max(0.62, Math.min(raw, 1.85))
}

/** Same LEARNCONNECT.NET / egitim.today lockup as generatePostImage.ts's BrandWatermark,
 * rendered as SVG so it can be composited onto a raster AI image via sharp. */
function watermarkSvg(spec: ImageSpec): string {
  const s = scaleFactor(spec)
  const padRight = Math.round(44 * s)
  const padBottom = Math.round(40 * s)
  const smallSize = Math.round(13 * s)
  const bigSize = Math.round(27 * s)
  const dotSize = Math.round(10 * s)
  const boxWidth = Math.round(280 * s)
  const boxHeight = Math.round(60 * s)
  const x = spec.width - padRight - boxWidth
  const y = spec.height - padBottom - boxHeight

  return `
    <svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" fill="rgba(255,255,255,0.82)" rx="10"/>
        <text x="${boxWidth - 14}" y="${Math.round(22 * s)}" text-anchor="end"
          font-family="Segoe UI, sans-serif" font-size="${smallSize}" font-weight="700"
          letter-spacing="2" fill="#94a3b8">LEARNCONNECT.NET</text>
        <text x="${boxWidth - 14 - dotSize - 8}" y="${Math.round(48 * s)}" text-anchor="end"
          font-family="Georgia, 'Times New Roman', serif" font-size="${bigSize}" font-weight="800"
          fill="#0f172a">egitim.today</text>
        <circle cx="${boxWidth - 14 - dotSize / 2}" cy="${Math.round(43 * s)}" r="${dotSize / 2}" fill="#22c55e"/>
      </g>
    </svg>
  `
}

async function applyWatermark(buffer: Buffer, spec: ImageSpec): Promise<Buffer> {
  const svg = Buffer.from(watermarkSvg(spec))
  return sharp(buffer)
    .resize(spec.width, spec.height, { fit: 'cover' })
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

export type AiImageVariation = {
  mediaId: string
  publicUrl: string
  provider: string
  seed: number
}

/** Generate 2–3 AI image variations for a derived content piece, sized per its target platform. */
export async function generateAiImageVariations(
  derivedContentId: string,
  count = 2,
): Promise<AiImageVariation[]> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { source: true },
  })
  if (!derived) throw new Error('Derived content not found')

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  const articleTitle =
    typeof meta.articleTitle === 'string' && meta.articleTitle.trim()
      ? meta.articleTitle.trim()
      : derived.source.title

  const targetPlatform = typeof meta.platform === 'string' ? meta.platform : null
  const specKey: PlatformImageKey = pickImageSpecKey(targetPlatform)
  const spec = getImageSpec(specKey)

  const design =
    (meta.imageDesign as PostImageDesign | undefined) ||
    (await extractPostImageDesign(articleTitle, derived.content))

  const prompt = buildPrompt(design)
  const variations: AiImageVariation[] = []
  const errors: string[] = []

  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 1_000_000)
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
      const result = await generateWithFallback({ prompt, width: spec.width, height: spec.height, seed })
      const finalBuffer = await applyWatermark(result.buffer, spec)

      const publicUrl = await persistGeneratedImage(media.id, finalBuffer, 'png')
      await prisma.mediaFile.update({
        where: { id: media.id },
        data: { fileUrl: publicUrl, fileSize: finalBuffer.length, processingStatus: 'COMPLETED' },
      })
      variations.push({ mediaId: media.id, publicUrl, provider: result.provider, seed })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`variation ${i + 1}: ${message}`)
      await prisma.mediaFile.update({ where: { id: media.id }, data: { processingStatus: 'FAILED' } })
    }
  }

  if (variations.length) {
    const fresh = await prisma.derivedContent.findUnique({
      where: { id: derivedContentId },
      select: { metadata: true },
    })
    const freshMeta =
      fresh?.metadata && typeof fresh.metadata === 'object' && !Array.isArray(fresh.metadata)
        ? { ...(fresh.metadata as Record<string, unknown>) }
        : { ...meta }
    // Don't resurrect quarantine flags from a stale metadata snapshot.
    delete freshMeta.reviewFault
    delete freshMeta.reviewFaultLast
    delete freshMeta.reviewFaults
    await prisma.derivedContent.update({
      where: { id: derivedContentId },
      data: {
        metadata: {
          ...freshMeta,
          aiImageVariations: variations,
          aiImagePrompt: prompt,
          aiImageSpecKey: specKey,
        } as Prisma.InputJsonValue,
      },
    })
    const { clearReviewFault } = await import('../review/fault')
    await clearReviewFault(derivedContentId).catch(() => {})
  }

  if (errors.length) {
    console.warn('[generateAiImageVariations] partial failures', errors)
  }

  return variations
}