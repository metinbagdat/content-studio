import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { generateWithFallback } from '../image/providers'
import { fetchBackgroundMusic } from './pixabayMusic'
import { toImagePrompt } from './visualPrompt'
import { buildSubtitleCues, cuesToSrt, subtitleMaxChars } from './subtitles'
import { renderVideo, type AspectRatio, type VideoScene } from './renderVideo'
import { persistGeneratedVideo, writeVideoFile } from './videoStorage'
import { writeImageFile, imageDiskPath } from '../media/imageStorage'
import { generatePodcastAudio } from '../media/generatePodcast'
import { extractPodcastSpeechParts, estimateSpeechDurationSec } from '../media/podcastText'
import { parsePodcastScript } from '../media/podcastSchema'
import { audioDiskPath } from '../media/tts'
import { expandVisualSlides } from '../media/videoScriptSchema'
import { getAudioDurationSec } from './audioDuration'
import sharp from 'sharp'

export type PodcastVideoVariant = { mediaId: string; publicUrl: string; aspect: AspectRatio }

/** Build YouTube-ready MP4 from podcast MP3 + slideshow visuals — reuses video render pipeline. */
export async function generatePodcastVideo(
  derivedContentId: string,
  aspects: AspectRatio[] = ['16:9'],
): Promise<PodcastVideoVariant[]> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { source: true },
  })
  if (!derived) throw new Error('Derived content not found')
  if (derived.contentType !== 'PODCAST_SCRIPT') {
    throw new Error('Sadece PODCAST_SCRIPT için video üretilebilir')
  }

  const audioResult = await generatePodcastAudio(derivedContentId)
  const audioPath = audioDiskPath(`${audioResult.media.id}.mp3`)
  const audioDurationSec = (await getAudioDurationSec(audioPath)) || audioResult.media.duration || 60

  const excerpt = derived.source?.content?.slice(0, 4000) || ''
  const { parts } = extractPodcastSpeechParts(derived.content, derived.title, { excerpt })
  const script = parsePodcastScript(derived.content, derived.title, excerpt)

  const segments = parts.map((text, i) => ({
    text,
    visualPrompt:
      script.segments[i]?.title ||
      script.segments[i]?.script?.slice(0, 80) ||
      derived.source.title,
  }))

  const estDurations = segments.map((s) => estimateSpeechDurationSec(s.text))
  const estTotal = estDurations.reduce((a, b) => a + b, 0) || 1
  const scale = audioDurationSec / estTotal
  const scaledDurations = estDurations.map((d) => d * scale)

  const visualSlides = expandVisualSlides(segments, scaledDurations, 4)
  const cues = visualSlides.flatMap((slide, i) => {
    if (!slide.subtitleText.trim()) return []
    const offset = visualSlides.slice(0, i).reduce((a, s) => a + s.durationSec, 0)
    return buildSubtitleCues(slide.subtitleText, slide.durationSec).map((c) => ({
      start: c.start + offset,
      end: c.end + offset,
      text: c.text,
    }))
  })
  const musicPath = await fetchBackgroundMusic('calm')

  const imagePaths: string[] = []
  const imageDurations: number[] = []
  for (let i = 0; i < visualSlides.length; i++) {
    const slide = visualSlides[i]
    const englishPrompt = await toImagePrompt(slide.visualPrompt)
    try {
      const result = await generateWithFallback({
        prompt: `${englishPrompt}, podcast cover art, flat minimalist illustration, soft gradient, no text, no letters`,
        width: 1280,
        height: 720,
        seed: Math.floor(Math.random() * 1_000_000),
      })
      const pngBuffer = await sharp(result.buffer)
        .resize(1280, 720, { fit: 'inside', withoutEnlargement: false })
        .png()
        .toBuffer()
      const filename = `${derivedContentId}-podcast-slide-${i}.png`
      await writeImageFile(filename, pngBuffer)
      imagePaths.push(imageDiskPath(filename))
      imageDurations.push(slide.durationSec)
    } catch (err) {
      console.warn(`[generatePodcastVideo] image ${i + 1} failed`, err)
    }
  }

  if (!imagePaths.length) {
    throw new Error('Podcast video için görsel üretilemedi')
  }

  const scenes: VideoScene[] = imagePaths.map((foreground, i) => {
    const n = imagePaths.length
    return {
      foreground,
      backgrounds: [imagePaths[(i - 1 + n) % n], foreground, imagePaths[(i + 1) % n]],
      durationSec: imageDurations[i] || 4,
    }
  })

  const variants: PodcastVideoVariant[] = []
  for (const aspect of aspects) {
    const media = await prisma.mediaFile.create({
      data: { derivedContentId, mediaType: 'VIDEO', fileUrl: '', format: 'mp4', processingStatus: 'PROCESSING' },
    })
    try {
      const srtForAspect = cuesToSrt(cues, subtitleMaxChars(aspect))
      const videoBuffer = await renderVideo({
        scenes,
        voiceoverPath: audioPath,
        musicPath,
        srtContent: srtForAspect,
        aspect,
      })
      await writeVideoFile(`${media.id}.srt`, Buffer.from(srtForAspect, 'utf-8'))
      const publicUrl = await persistGeneratedVideo(media.id, videoBuffer)
      await prisma.mediaFile.update({
        where: { id: media.id },
        data: {
          fileUrl: publicUrl,
          fileSize: videoBuffer.length,
          duration: Math.round(audioDurationSec),
          processingStatus: 'COMPLETED',
        },
      })
      variants.push({ mediaId: media.id, publicUrl, aspect })
    } catch (err) {
      console.warn(`[generatePodcastVideo] ${aspect} failed`, err)
      await prisma.mediaFile.update({ where: { id: media.id }, data: { processingStatus: 'FAILED' } })
    }
  }

  if (variants.length) {
    const meta =
      derived.metadata && typeof derived.metadata === 'object' ? (derived.metadata as Record<string, unknown>) : {}
    await prisma.derivedContent.update({
      where: { id: derivedContentId },
      data: {
        metadata: { ...meta, podcastVideoVariants: variants } as Prisma.InputJsonValue,
      },
    })
  }

  return variants
}
