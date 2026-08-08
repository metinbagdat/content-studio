import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { prisma } from '../prisma'
import { synthesizeSpeech } from './tts'
import { audioStorageDir, writeAudioFile, audioDiskPath } from './tts'
import { ttsPronunciation } from './pronunciation'
import { fetchBackgroundMusic } from '../video/pixabayMusic'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

function mixVoiceAndMusic(voicePath: string, musicPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(voicePath)
      .input(musicPath)
      .complexFilter(
        ['[0:a]volume=1.0[voice]', '[1:a]volume=0.2[music]', '[voice][music]amix=inputs=2:duration=first[out]'],
        ['out'],
      )
      .outputOptions(['-c:a', 'libmp3lame'])
      .output(outputPath)
      .on('start', (cmd) => console.log('[ffmpeg cmd]', cmd))
      .on('stderr', (line) => console.error('[ffmpeg stderr]', line))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

/** Turn march/song lyrics into spoken-word audio over royalty-free instrumental backing —
 * not a real sung composition (that requires Suno/Udio, deferred — see issue #7 discussion),
 * but a usable, zero-cost, zero-risk audio piece in the meantime. */
export async function generateSongAudio(derivedContentId: string) {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { mediaFiles: { where: { mediaType: 'AUDIO', processingStatus: 'COMPLETED' } } },
  })
  if (!derived) throw new Error('Derived content not found')
  if (!['MARCH_LYRICS', 'SONG_LYRICS'].includes(derived.contentType)) {
    throw new Error('Sadece MARCH_LYRICS veya SONG_LYRICS için ses üretilebilir')
  }

  const existing = derived.mediaFiles[0]
  if (existing) return { media: existing, reused: true }

  const isMarch = derived.contentType === 'MARCH_LYRICS'
  const mood = isMarch ? 'marching band anthem, uplifting, orchestral' : 'pop, uplifting, motivational'

  const media = await prisma.mediaFile.create({
    data: { derivedContentId, mediaType: 'AUDIO', fileUrl: '', format: 'mp3', processingStatus: 'PROCESSING' },
  })

  try {
    const voiceBuffer = await synthesizeSpeech(ttsPronunciation(derived.content.slice(0, 4000)))
    const voiceFilename = `${media.id}-voice.mp3`
    await writeAudioFile(voiceFilename, voiceBuffer)
    const voicePath = audioDiskPath(voiceFilename)

    const musicPath = await fetchBackgroundMusic(mood)

    const finalFilename = `${media.id}.mp3`
    const finalPath = path.join(audioStorageDir(), finalFilename)

    if (musicPath) {
      await mixVoiceAndMusic(voicePath, musicPath, finalPath)
    } else {
      // No local track available yet — fall back to voice-only rather than failing
      await writeAudioFile(finalFilename, voiceBuffer)
    }

    const { readFile } = await import('fs/promises')
    const finalBuffer = await readFile(finalPath)

    const updated = await prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        fileUrl: `/api/media/${media.id}/file`,
        fileSize: finalBuffer.length,
        processingStatus: 'COMPLETED',
      },
    })
    return { media: updated, reused: false, hasMusicBed: Boolean(musicPath) }
  } catch (err) {
    await prisma.mediaFile.update({ where: { id: media.id }, data: { processingStatus: 'FAILED' } })
    throw err
  }
}