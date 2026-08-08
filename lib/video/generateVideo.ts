import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { generateWithFallback } from '../image/providers'
import { fetchBackgroundMusic } from './pixabayMusic'
import { toImagePrompt } from './visualPrompt'
import { translateSegmentsToEnglish } from './translateSegments'
import { buildSubtitleCues, cuesToSrt, type SubtitleCue } from './subtitles'
import { renderVideo, dimensionsForAspect, type AspectRatio, type VideoScene } from './renderVideo'
import { writeVideoFile, publicMediaVideoUrl } from './videoStorage'
import { writeImageFile, imageDiskPath } from '../media/imageStorage'
import { assembleSpeechVoiceover } from '../media/ttsSegments'
import { parseVideoScript, expandVisualSlides, type VisualSlide } from '../media/videoScriptSchema'
import sharp from 'sharp'

const EN_VOICE = process.env.TTS_EDGE_VOICE_EN || 'en-US-AriaNeural'

export type VideoVariant = { mediaId: string; publicUrl: string; aspect: AspectRatio }
export type VideoLanguage = 'tr' | 'en'

type ScriptSegment = { text: string; visualPrompt: string }

function buildFullSubtitlesFromSlides(slides: VisualSlide[]): SubtitleCue[] {
  let cursor = 0
  const allCues: SubtitleCue[] = []
  slides.forEach((slide) => {
    if (!slide.subtitleText.trim()) {
      cursor += slide.durationSec
      return
    }
    const cues = buildSubtitleCues(slide.subtitleText, slide.durationSec)
    cues.forEach((c) => allCues.push({ start: c.start + cursor, end: c.end + cursor, text: c.text }))
    cursor += slide.durationSec
  })
  return allCues
}

/** Generate video for a VIDEO_SCRIPT derived content. Defaults to 16:9 + Turkish —
 * pass aspects: ['9:16'] for TikTok/Shorts, language: 'en' for the English version. */
export async function generateVideoVariants(
  derivedContentId: string,
  aspects: AspectRatio[] = ['16:9'],
  language: VideoLanguage = 'tr',
): Promise<VideoVariant[]> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { source: true },
  })
  if (!derived) throw new Error('Derived content not found')

  const raw = derived.content.trim()
  if (!raw) throw new Error('Script içeriği boş')

  const trSegments = parseVideoScript(raw, derived.source.title, derived.source.title)
  const segments = language === 'en' ? await translateSegmentsToEnglish(trSegments) : trSegments

  const activeIndices = segments
    .map((s, i) => (s.text.trim() ? i : -1))
    .filter((i) => i >= 0)
  const activeSegments = activeIndices.map((i) => segments[i])
  const activeTrSegments = activeIndices.map((i) => trSegments[i])

  const voice = language === 'en' ? EN_VOICE : undefined
  const speech = await assembleSpeechVoiceover({
    segments: activeSegments.map((s) => s.text),
    workKey: derivedContentId,
    language,
    voice,
    minSegmentSec: 5,
    pauseSec: 1.2,
    outroPadSec: 3,
  })
  const voiceoverPath = speech.voiceoverPath
  const realDurationSec = speech.totalSec
  const durations = speech.segmentDisplayDurations

  const visualSlides = expandVisualSlides(activeSegments, durations, 3.5)
  const trVisualSlides = expandVisualSlides(activeTrSegments, durations, 3.5)

  // 3) Subtitles — timed against shorter visual slides
  const cues = buildFullSubtitlesFromSlides(visualSlides)
  const srtContent = cuesToSrt(cues)

  // 4) Background music — local library or generated ambient fallback
  const musicPath = await fetchBackgroundMusic('inspiring corporate')

  // 5) One AI image per visual slide (~3.5s) for fluid background changes
  const imagePaths: string[] = []
  const imageDurations: number[] = []
  for (let i = 0; i < visualSlides.length; i++) {
    const slide = visualSlides[i]
    const trSlide = trVisualSlides[i]
    const englishPrompt = await toImagePrompt(trSlide?.visualPrompt || slide.visualPrompt)
    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await generateWithFallback({
          prompt: `${englishPrompt}, flat minimalist illustration, soft gradient background, no text, no letters, no words, no watermark`,
          width: 1280,
          height: 720,
          seed: Math.floor(Math.random() * 1_000_000),
        })
        const pngBuffer = await sharp(result.buffer)
          .resize(1280, 720, { fit: 'inside', withoutEnlargement: false })
          .png()
          .toBuffer()
        const filename = `${derivedContentId}-slide-${language}-${i}.png`
        await writeImageFile(filename, pngBuffer)
        imagePaths.push(imageDiskPath(filename))
        imageDurations.push(slide.durationSec)
        lastError = null
        break
      } catch (err) {
        lastError = err
        console.warn(`[generateVideoVariants] image ${i + 1} attempt ${attempt} failed`, err)
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt))
      }
    }
    if (lastError) {
      console.warn(`[generateVideoVariants] segment ${i + 1} image failed after 3 attempts, skipping`)
    }
  }

  if (imagePaths.length === 0) {
    throw new Error('Hiçbir görsel üretilemedi (tüm provider denemeleri başarısız) — daha sonra tekrar deneyin')
  }

  const scenes: VideoScene[] = imagePaths.map((foreground, i) => {
    const n = imagePaths.length
    const prev = imagePaths[(i - 1 + n) % n]
    const next = imagePaths[(i + 1) % n]
    return {
      foreground,
      backgrounds: [prev, foreground, next],
      durationSec: imageDurations[i] || 3.5,
    }
  })

  // 6) Render one file per requested aspect ratio
  const variants: VideoVariant[] = []
  for (const aspect of aspects) {
    const media = await prisma.mediaFile.create({
      data: { derivedContentId, mediaType: 'VIDEO', fileUrl: '', format: 'mp4', processingStatus: 'PROCESSING' },
    })
    try {
      const videoBuffer = await renderVideo({
        scenes,
        voiceoverPath,
        musicPath,
        srtContent,
        aspect,
      })
      const filename = `${media.id}.mp4`
      await writeVideoFile(filename, videoBuffer)
      const publicUrl = publicMediaVideoUrl(media.id)
      await prisma.mediaFile.update({
        where: { id: media.id },
        data: {
          fileUrl: publicUrl,
          fileSize: videoBuffer.length,
          duration: Math.round(realDurationSec),
          processingStatus: 'COMPLETED',
        },
      })
      variants.push({ mediaId: media.id, publicUrl, aspect })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[generateVideoVariants] ${aspect} failed`, message)
      await prisma.mediaFile.update({ where: { id: media.id }, data: { processingStatus: 'FAILED' } })
    }
  }

  if (variants.length) {
    const meta =
      derived.metadata && typeof derived.metadata === 'object' ? (derived.metadata as Record<string, unknown>) : {}
    await prisma.derivedContent.update({
      where: { id: derivedContentId },
      data: {
        metadata: {
          ...meta,
          [language === 'en' ? 'videoVariantsEn' : 'videoVariants']: variants,
        } as Prisma.InputJsonValue,
      },
    })
  }

  if (variants.length && language === 'tr') {
    try {
      const { generateAiImageVariations } = await import('../image/generateAiImage')
      await generateAiImageVariations(derivedContentId, 1)
    } catch (err) {
      console.warn('[generateVideoVariants] thumbnail generation failed (non-fatal)', err)
    }
  }

  return variants
}

/** Convenience wrapper: vertical (9:16), burned-in captions, single language — ready for TikTok/Shorts/Reels. */
export async function generateTikTokVideo(
  derivedContentId: string,
  language: VideoLanguage = 'tr',
): Promise<VideoVariant[]> {
  return generateVideoVariants(derivedContentId, ['9:16'], language)
}