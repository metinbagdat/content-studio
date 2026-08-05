import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { synthesizeSpeech, writeAudioFile, audioDiskPath } from '../media/tts'
import { generateWithFallback } from '../image/providers'
import { fetchBackgroundMusic } from './pixabayMusic'
import { getAudioDurationSec } from './audioDuration'
import { toImagePrompt } from './visualPrompt'
import { translateSegmentsToEnglish } from './translateSegments'
import { buildSubtitleCues, cuesToSrt, type SubtitleCue } from './subtitles'
import { renderVideo, dimensionsForAspect, type AspectRatio } from './renderVideo'
import { writeVideoFile, publicMediaVideoUrl } from './videoStorage'
import { writeImageFile, imageDiskPath } from '../media/imageStorage'
import sharp from 'sharp'
import { ttsPronunciation } from '../media/pronunciation'

const EN_VOICE = process.env.TTS_EDGE_VOICE_EN || 'en-US-AriaNeural'

export type VideoVariant = { mediaId: string; publicUrl: string; aspect: AspectRatio }
export type VideoLanguage = 'tr' | 'en'

type ScriptSegment = { text: string; visualPrompt: string }

/** Parse VIDEO_SCRIPT JSON (hook/scenes/callToAction), tolerating ```json fences some LLM outputs wrap around it. */
function parseVideoScript(raw: string, fallbackVisual: string): ScriptSegment[] {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  try {
    const data = JSON.parse(unfenced) as {
      hook?: string
      scenes?: Array<{ description?: string; visuals?: string; narration?: string }>
      callToAction?: string
    }
    const segments: ScriptSegment[] = []

    if (data.hook) {
      segments.push({ text: data.hook, visualPrompt: data.scenes?.[0]?.visuals || fallbackVisual })
    }
    for (const scene of data.scenes || []) {
      if (scene.narration) {
        segments.push({
          text: scene.narration,
          visualPrompt: scene.visuals || scene.description || fallbackVisual,
        })
      }
    }
    if (data.callToAction) {
      const cleaned = data.callToAction.replace(/https?:\/\/\S+/g, '').trim()
      if (cleaned) {
        segments.push({ text: cleaned, visualPrompt: 'warm inviting education technology, logo card' })
      }
    }

    if (segments.length) return segments
  } catch {
    /* not JSON — fall through to plain text */
  }

  return [{ text: raw.trim(), visualPrompt: fallbackVisual }]
}

/** Split a known total duration across segments proportional to their text length. */
function segmentDurations(segments: ScriptSegment[], totalDurationSec: number): number[] {
  const lengths = segments.map((s) => s.text.length)
  const total = lengths.reduce((a, b) => a + b, 0) || 1
  return lengths.map((l) => Math.max(1, (l / total) * totalDurationSec))
}

function buildFullSubtitles(segments: ScriptSegment[], durations: number[]): SubtitleCue[] {
  let cursor = 0
  const allCues: SubtitleCue[] = []
  segments.forEach((seg, i) => {
    const cues = buildSubtitleCues(seg.text, durations[i])
    cues.forEach((c) => allCues.push({ start: c.start + cursor, end: c.end + cursor, text: c.text }))
    cursor += durations[i]
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

  const trSegments = parseVideoScript(raw, derived.source.title)
  const segments = language === 'en' ? await translateSegmentsToEnglish(trSegments) : trSegments

  // 1) Voiceover FIRST — speak narration only, never raw JSON field names
  const spokenText = segments
    .map((s) => (language === 'tr' ? ttsPronunciation(s.text) : s.text.replace(/https?:\/\/\S+/g, '')))
    .join('. ')
  const voice = language === 'en' ? EN_VOICE : undefined
  const voiceBuffer = await synthesizeSpeech(spokenText, voice)
  const voiceFilename = `${derivedContentId}-voice-${language}.mp3`
  await writeAudioFile(voiceFilename, voiceBuffer)
  const voiceoverPath = audioDiskPath(voiceFilename)

  // 2) Measure REAL audio duration — everything else syncs to this, not an estimate
  const realDurationSec = await getAudioDurationSec(voiceoverPath)
  const durations = segmentDurations(segments, realDurationSec)

  // 3) Subtitles — timed against the real audio length
  const cues = buildFullSubtitles(segments, durations)
  const srtContent = cuesToSrt(cues)

  // 4) Background music (best-effort — null if Pixabay unavailable; march/song audio planned for issue #7)
  const musicPath = await fetchBackgroundMusic('inspiring corporate')

  // 5) One AI image per segment — English-translated visual prompt for reliable model adherence,
  // timed to that segment's real speaking duration.
  const imagePaths: string[] = []
  const imageDurations: number[] = []
  for (let i = 0; i < trSegments.length; i++) {
    const englishPrompt = await toImagePrompt(trSegments[i].visualPrompt)
    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await generateWithFallback({
          prompt: `${englishPrompt}, flat minimalist illustration, soft gradient background, no text, no letters, no words, no watermark`,
          width: 1280,
          height: 720,
          seed: Math.floor(Math.random() * 1_000_000),
        })
        const pngBuffer = await sharp(result.buffer).resize(1280, 720, { fit: 'cover' }).png().toBuffer()
        const filename = `${derivedContentId}-slide-${language}-${i}.png`
        await writeImageFile(filename, pngBuffer)
        imagePaths.push(imageDiskPath(filename))
        imageDurations.push(durations[i])
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

  // 6) Render one file per requested aspect ratio
  const variants: VideoVariant[] = []
  for (const aspect of aspects) {
    const media = await prisma.mediaFile.create({
      data: { derivedContentId, mediaType: 'VIDEO', fileUrl: '', format: 'mp4', processingStatus: 'PROCESSING' },
    })
    try {
      const videoBuffer = await renderVideo({
        imagePaths,
        imageDurations,
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