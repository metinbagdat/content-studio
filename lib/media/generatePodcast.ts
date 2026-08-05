import { unlink, mkdtemp, writeFile, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { prisma } from '../prisma'
import { extractPodcastSpeechParts, estimateSpeechDurationSec } from './podcastText'
import { synthesizeSpeech, writeAudioFile, ttsModeLabel, audioDiskPath, audioStorageDir } from './tts'
import { fetchBackgroundMusic } from '../video/pixabayMusic'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

export { getMediaFile, listMedia } from './mediaDb'

const INTRO_JINGLE_SEC = 4
const MID_JINGLE_SEC = 2.5
const OUTRO_JINGLE_SEC = 4

function renderJingle(
  musicPath: string,
  outputPath: string,
  durationSec: number,
  mode: 'intro' | 'mid' | 'outro',
): Promise<void> {
  let chain = `[0:a]atrim=0:${durationSec}`
  if (mode === 'intro') {
    chain += `,afade=t=out:st=${Math.max(0, durationSec - 1)}:d=1`
  } else if (mode === 'outro') {
    chain += `,afade=t=in:st=0:d=0.8`
  } else {
    chain += `,afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0, durationSec - 0.8)}:d=0.8`
  }
  chain += '[out]'

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(musicPath)
      .complexFilter([chain], ['out'])
      .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

function concatAudioFiles(inputPaths: string[], outputPath: string): Promise<void> {
  const listContent = inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  const listPath = `${outputPath}.concat.txt`

  return writeFile(listPath, listContent, 'utf8').then(
    () =>
      new Promise((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k'])
          .output(outputPath)
          .on('end', () => {
            unlink(listPath).catch(() => {})
            resolve()
          })
          .on('error', (err) => {
            unlink(listPath).catch(() => {})
            reject(err)
          })
          .run()
      }),
  )
}

/** intro jingle → part₁ → mid jingle → part₂ → … → outro jingle */
async function assemblePodcastWithJingles(
  partPaths: string[],
  outputPath: string,
): Promise<{ ok: boolean; jingleCount: number }> {
  const musicPath = await fetchBackgroundMusic('calm')
  if (!musicPath || !partPaths.length) return { ok: false, jingleCount: 0 }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'podcast-jingle-'))
  const concatList: string[] = []
  let jingleCount = 0

  try {
    const introPath = path.join(tempDir, 'intro.mp3')
    await renderJingle(musicPath, introPath, INTRO_JINGLE_SEC, 'intro')
    concatList.push(introPath)
    jingleCount += 1

    for (let i = 0; i < partPaths.length; i++) {
      concatList.push(partPaths[i])

      const isLast = i === partPaths.length - 1
      if (!isLast) {
        const midPath = path.join(tempDir, `mid-${i}.mp3`)
        await renderJingle(musicPath, midPath, MID_JINGLE_SEC, 'mid')
        concatList.push(midPath)
        jingleCount += 1
      }
    }

    const outroPath = path.join(tempDir, 'outro.mp3')
    await renderJingle(musicPath, outroPath, OUTRO_JINGLE_SEC, 'outro')
    concatList.push(outroPath)
    jingleCount += 1

    await concatAudioFiles(concatList, outputPath)
    return { ok: true, jingleCount }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function deleteExistingPodcastMedia(mediaId: string): Promise<void> {
  const base = audioStorageDir()
  for (const suffix of ['', '-narration']) {
    for (const part of [`${mediaId}${suffix}.mp3`]) {
      await unlink(path.join(base, part)).catch(() => {})
    }
  }
  await unlink(path.join(base, `${mediaId}.mp3`)).catch(() => {})
  await prisma.mediaFile.delete({ where: { id: mediaId } }).catch(() => {})
}

export async function generatePodcastAudio(
  derivedContentId: string,
  options: { force?: boolean } = {},
) {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: {
      source: { select: { content: true } },
      mediaFiles: { where: { mediaType: 'AUDIO', processingStatus: 'COMPLETED' } },
    },
  })
  if (!derived) throw new Error('Derived content not found')
  if (derived.contentType !== 'PODCAST_SCRIPT') {
    throw new Error('Sadece PODCAST_SCRIPT için ses üretilebilir')
  }

  const existing = derived.mediaFiles[0]
  if (existing && !options.force) {
    return { media: existing, reused: true, mode: ttsModeLabel() }
  }
  if (existing && options.force) {
    await deleteExistingPodcastMedia(existing.id)
  }

  const excerpt = derived.source?.content?.slice(0, 4000) || ''
  const { parts, fullText } = extractPodcastSpeechParts(derived.content, derived.title, { excerpt })
  if (!parts.length) throw new Error('Konuşulacak podcast metni bulunamadı')

  const media = await prisma.mediaFile.create({
    data: {
      derivedContentId,
      mediaType: 'AUDIO',
      fileUrl: '',
      format: 'mp3',
      processingStatus: 'PROCESSING',
    },
  })

  const tempPartPaths: string[] = []

  try {
    for (let i = 0; i < parts.length; i++) {
      const buffer = await synthesizeSpeech(parts[i])
      const partFilename = `${media.id}-part-${i}.mp3`
      await writeAudioFile(partFilename, buffer)
      tempPartPaths.push(audioDiskPath(partFilename))
    }

    const finalFilename = `${media.id}.mp3`
    const finalPath = path.join(audioStorageDir(), finalFilename)

    let hasJingles = false
    let jingleCount = 0
    try {
      const assembled = await assemblePodcastWithJingles(tempPartPaths, finalPath)
      hasJingles = assembled.ok
      jingleCount = assembled.jingleCount
    } catch (err) {
      console.warn('[generatePodcastAudio] jingle assembly failed, falling back to narration-only', err)
    }

    if (!hasJingles) {
      if (tempPartPaths.length === 1) {
        const single = await readFile(tempPartPaths[0])
        await writeAudioFile(finalFilename, single)
      } else {
        await concatAudioFiles(tempPartPaths, finalPath)
      }
    }

    const finalBuffer = await readFile(finalPath)
    const jingleDuration = hasJingles ? INTRO_JINGLE_SEC + OUTRO_JINGLE_SEC + MID_JINGLE_SEC * Math.max(0, parts.length - 1) : 0
    const duration = estimateSpeechDurationSec(fullText) + Math.round(jingleDuration)

    const updated = await prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        fileUrl: `/api/media/${media.id}/file`,
        fileSize: finalBuffer.length,
        duration,
        processingStatus: 'COMPLETED',
      },
    })

    for (const p of tempPartPaths) {
      await unlink(p).catch(() => {})
    }

    return {
      media: updated,
      reused: false,
      mode: ttsModeLabel(),
      durationSec: duration,
      hasJingles,
      jingleCount,
      partCount: parts.length,
    }
  } catch (err) {
    for (const p of tempPartPaths) {
      await unlink(p).catch(() => {})
    }
    await prisma.mediaFile.update({ where: { id: media.id }, data: { processingStatus: 'FAILED' } })
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(message)
  }
}
