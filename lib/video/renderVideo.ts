import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { mkdir, writeFile, rm } from 'fs/promises'
import path from 'path'
import { videoWorkDir } from './videoStorage'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

export type AspectRatio = '16:9' | '9:16' | '1:1'

export function dimensionsForAspect(aspect: AspectRatio): { width: number; height: number } {
  switch (aspect) {
    case '16:9':
      return { width: 1920, height: 1080 }
    case '9:16':
      return { width: 1080, height: 1920 }
    case '1:1':
      return { width: 1080, height: 1080 }
  }
}

/** Stage A: turn N still images into a silent slideshow with crossfade transitions,
 * each image held for its own duration (synced to that scene's narration length). */
async function buildSlideshow(
  imagePaths: string[],
  imageDurations: number[],
  aspect: AspectRatio,
  outputPath: string,
): Promise<void> {
  const { width, height } = dimensionsForAspect(aspect)
  const transitionSec = 0.8
  const SAFETY_PAD_SEC = 2.5 // ensures slideshow always outlasts the voiceover — never cut mid-sentence

  // Pad the last image's hold time so total slideshow duration has margin over audio duration
  const paddedDurations = imageDurations.map((d, i) =>
    i === imageDurations.length - 1 ? d + SAFETY_PAD_SEC : d,
  )

  // aşağıdaki tüm `imageDurations[i]` kullanımlarını `paddedDurations[i]` ile değiştir

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
    imagePaths.forEach((p, i) =>
      cmd.input(p).inputOptions(['-loop 1', `-t ${(paddedDurations[i] + transitionSec).toFixed(2)}`]),
    )

    const scaleFilters = imagePaths.map(
      (_, i) =>
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=25[v${i}]`,
    )

    if (imagePaths.length === 1) {
      const filter = scaleFilters[0].replace('[v0]', '[outv]')
      cmd
        .complexFilter(filter, ['outv'])
        .outputOptions(['-r 25', '-pix_fmt yuv420p'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run()
      return
    }

    let chain = '[v0]'
    let cumulative = paddedDurations[0]
    const xfadeFilters: string[] = []
    for (let i = 1; i < imagePaths.length; i++) {
      const offset = Math.max(0, cumulative - transitionSec * i)
      const outLabel = i === imagePaths.length - 1 ? 'outv' : `x${i}`
      xfadeFilters.push(
        `${chain}[v${i}]xfade=transition=fade:duration=${transitionSec}:offset=${offset.toFixed(2)}[${outLabel}]`,
      )
      chain = `[${outLabel}]`
      cumulative += paddedDurations[i]
    }

    const filter = `${scaleFilters.join(';')};${xfadeFilters.join(';')}`

    cmd
      .complexFilter(filter, ['outv'])
      .outputOptions(['-r 25', '-pix_fmt yuv420p'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

/** Stage B: mux slideshow + voiceover (+ optional music) + burn-in subtitles + watermark into the final mp4. */
async function combineAudioAndSubtitles(options: {
  slideshowPath: string
  voiceoverPath: string
  musicPath?: string | null
  srtPath: string
  outputPath: string
}): Promise<void> {
  const { slideshowPath, voiceoverPath, musicPath, srtPath, outputPath } = options
  const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(slideshowPath).input(voiceoverPath)
    if (musicPath) cmd.input(musicPath)

    const audioFilter = musicPath
      ? '[1:a]volume=1.0[voice];[2:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first[outa]'
      : '[1:a]volume=1.0[outa]'

    const videoFilter =
      `[0:v]subtitles='${escapedSrt}':force_style='FontSize=18,PrimaryColour=&HFFFFFF&,` +
      `BackColour=&H00000000&,BorderStyle=3,Outline=0,Shadow=0,MarginV=40'[subbed];` +
      `[subbed]drawtext=text='LEARNCONNECT.NET':fontsize=16:fontcolor=white@0.75:` +
      `x=w-tw-30:y=h-90:box=1:boxcolor=black@0.35:boxborderw=6,` +
      `drawtext=text='egitim.today':fontsize=26:fontcolor=white:x=w-tw-30:y=h-60:` +
      `box=1:boxcolor=black@0.35:boxborderw=6[outv]`

    cmd
      .complexFilter([videoFilter, audioFilter], ['outv', 'outa'])
      .outputOptions(['-c:v libx264', '-c:a aac'])  // '-shortest' KALDIRILDI
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

export type RenderVideoInput = {
  imagePaths: string[]
  imageDurations: number[]
  voiceoverPath: string
  musicPath?: string | null
  srtContent: string
  aspect: AspectRatio
}

/** Full render: images → crossfade slideshow → mux with voiceover/music/subtitles/watermark → final mp4 buffer. */
export async function renderVideo(input: RenderVideoInput): Promise<Buffer> {
  const { readFile: fsReadFile } = await import('fs/promises')
  const workDir = path.join(videoWorkDir(), crypto.randomUUID())
  await mkdir(workDir, { recursive: true })

  const slideshowPath = path.join(workDir, 'slideshow.mp4')
  const srtPath = path.join(workDir, 'subs.srt')
  const finalPath = path.join(workDir, 'final.mp4')

  try {
    await writeFile(srtPath, input.srtContent, 'utf-8')
    await buildSlideshow(input.imagePaths, input.imageDurations, input.aspect, slideshowPath)
    await combineAudioAndSubtitles({
      slideshowPath,
      voiceoverPath: input.voiceoverPath,
      musicPath: input.musicPath,
      srtPath,
      outputPath: finalPath,
    })
    return await fsReadFile(finalPath)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}