import { prisma } from '../prisma'
import { extractPodcastSpeech, estimateSpeechDurationSec } from './podcastText'
import { synthesizeSpeech, writeAudioFile, ttsModeLabel } from './tts'

export { getMediaFile, listMedia } from './mediaDb'

export async function generatePodcastAudio(derivedContentId: string) {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { mediaFiles: { where: { mediaType: 'AUDIO', processingStatus: 'COMPLETED' } } },
  })
  if (!derived) throw new Error('Derived content not found')
  if (derived.contentType !== 'PODCAST_SCRIPT') {
    throw new Error('Sadece PODCAST_SCRIPT için ses üretilebilir')
  }

  const existing = derived.mediaFiles[0]
  if (existing) {
    return { media: existing, reused: true, mode: ttsModeLabel() }
  }

  const speech = extractPodcastSpeech(derived.content, derived.title)
  const media = await prisma.mediaFile.create({
    data: {
      derivedContentId,
      mediaType: 'AUDIO',
      fileUrl: '',
      format: 'mp3',
      processingStatus: 'PROCESSING',
    },
  })

  try {
    const buffer = await synthesizeSpeech(speech)
    const filename = `${media.id}.mp3`
    await writeAudioFile(filename, buffer)
    const duration = estimateSpeechDurationSec(speech)

    const updated = await prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        fileUrl: `/api/media/${media.id}/file`,
        fileSize: buffer.length,
        duration,
        processingStatus: 'COMPLETED',
      },
    })

    return { media: updated, reused: false, mode: ttsModeLabel(), durationSec: duration }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.mediaFile.update({
      where: { id: media.id },
      data: { processingStatus: 'FAILED' },
    })
    throw new Error(message)
  }
}
