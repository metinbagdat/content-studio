import { mkdir, writeFile, rm, readFile } from 'fs/promises'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { synthesizeSpeech, audioDiskPath } from './tts'
import { sanitizeSpeechText } from './speechText'
import { getAudioDurationSec } from '../video/audioDuration'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const DEFAULT_PAUSE_SEC = 1.2
const DEFAULT_OUTRO_PAD_SEC = 3

export type SpeechAssemblyResult = {
  voiceoverPath: string
  segmentAudioDurations: number[]
  segmentDisplayDurations: number[]
  totalSec: number
}

function makeSilence(outputPath: string, durationSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('anullsrc=r=24000:cl=mono')
      .inputFormat('lavfi')
      .outputOptions(['-t', String(durationSec), '-c:a', 'libmp3lame', '-b:a', '128k'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

function concatMp3Files(inputPaths: string[], outputPath: string): Promise<void> {
  const listPath = `${outputPath}.txt`
  const listContent = inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  return writeFile(listPath, listContent, 'utf8').then(
    () =>
      new Promise((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k'])
          .output(outputPath)
          .on('end', () => {
            rm(listPath).catch(() => {})
            resolve()
          })
          .on('error', (err) => {
            rm(listPath).catch(() => {})
            reject(err)
          })
          .run()
      }),
  )
}

/** Synthesize each segment separately, insert pauses, optional outro pad — longer natural pacing. */
export async function assembleSpeechVoiceover(options: {
  segments: string[]
  workKey: string
  language?: 'tr' | 'en'
  voice?: string
  minSegmentSec?: number
  pauseSec?: number
  outroPadSec?: number
}): Promise<SpeechAssemblyResult> {
  const {
    segments,
    workKey,
    language = 'tr',
    voice,
    minSegmentSec = 5,
    pauseSec = DEFAULT_PAUSE_SEC,
    outroPadSec = DEFAULT_OUTRO_PAD_SEC,
  } = options

  const workDir = path.join(process.cwd(), 'storage', 'audio', `speech-${workKey}`)
  await mkdir(workDir, { recursive: true })

  const segmentPaths: string[] = []
  const segmentAudioDurations: number[] = []

  for (let i = 0; i < segments.length; i++) {
    const raw = segments[i].trim()
    if (!raw) continue
    const spoken = sanitizeSpeechText(raw, language)
    if (!spoken) continue

    const buf = await synthesizeSpeech(spoken, voice)
    const partPath = path.join(workDir, `part-${i}.mp3`)
    await writeFile(partPath, buf)
    const dur = await getAudioDurationSec(partPath)
    segmentPaths.push(partPath)
    segmentAudioDurations.push(dur)
  }

  if (!segmentPaths.length) throw new Error('Konuşulacak segment yok')

  const segmentDisplayDurations = segmentAudioDurations.map((d) =>
    Math.max(d, minSegmentSec),
  )

  const concatList: string[] = []
  for (let i = 0; i < segmentPaths.length; i++) {
    concatList.push(segmentPaths[i])
    if (i < segmentPaths.length - 1) {
      const pausePath = path.join(workDir, `pause-${i}.mp3`)
      await makeSilence(pausePath, pauseSec)
      concatList.push(pausePath)
    }
  }

  if (outroPadSec > 0) {
    const outroPath = path.join(workDir, 'outro-pad.mp3')
    await makeSilence(outroPath, outroPadSec)
    concatList.push(outroPath)
    segmentDisplayDurations[segmentDisplayDurations.length - 1] += outroPadSec
  }

  const finalFilename = `${workKey}-voice-${language}.mp3`
  const finalPath = path.join(workDir, finalFilename)
  await concatMp3Files(concatList, finalPath)

  const totalSec = await getAudioDurationSec(finalPath)
  const publicPath = audioDiskPath(finalFilename)
  await writeFile(publicPath, await readFile(finalPath))

  await rm(workDir, { recursive: true, force: true }).catch(() => {})

  return {
    voiceoverPath: publicPath,
    segmentAudioDurations,
    segmentDisplayDurations,
    totalSec,
  }
}
