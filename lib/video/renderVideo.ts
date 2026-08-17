import ffmpeg from 'fluent-ffmpeg'
import { mkdir, writeFile, rm } from 'fs/promises'
import path from 'path'
import { configureFfmpeg } from '@/lib/media/ffmpegPaths'
import { videoWorkDir } from './videoStorage'

configureFfmpeg()

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

export type VideoScene = {
  /** Main image — letterboxed, aspect ratio preserved */
  foreground: string
  /** 1–3 background layers for depth / motion */
  backgrounds: string[]
  durationSec: number
}

/** One scene: blurred animated background layers + centered foreground (no stretch/crop). */
async function buildSceneClip(
  scene: VideoScene,
  aspect: AspectRatio,
  outputPath: string,
): Promise<void> {
  const { width, height } = dimensionsForAspect(aspect)
  const fps = 25
  const duration = scene.durationSec + 0.45
  const frames = Math.max(25, Math.ceil(duration * fps))

  const bgs = [...scene.backgrounds.slice(0, 3)]
  while (bgs.length < 3) bgs.push(scene.foreground)

  const bgFill = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
  const fgFit = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a0a12`

  const filter = [
    `[0:v]${bgFill},boxblur=28:8,eq=brightness=-0.38,zoompan=z='min(zoom+0.0012,1.3)':x='iw/2-(iw/zoom/2)+25*sin(on/25)':y='ih/2-(ih/zoom/2)+12*cos(on/30)':d=${frames}:s=${width}x${height}:fps=${fps}[bg0]`,
    `[1:v]${bgFill},boxblur=16:4,eq=brightness=-0.22,zoompan=z='max(1.2-on*0.0008,1.0)':x='iw/2-(iw/zoom/2)+30*sin(on/28)':y='ih/2-(ih/zoom/2)+18*cos(on/32)':d=${frames}:s=${width}x${height}:fps=${fps}[bg1]`,
    `[2:v]${bgFill},boxblur=8:2,eq=brightness=-0.08,zoompan=z='min(zoom+0.0018,1.4)':x='iw/2-(iw/zoom/2)-20*cos(on/22)':y='ih/2-(ih/zoom/2)+10*sin(on/26)':d=${frames}:s=${width}x${height}:fps=${fps}[bg2]`,
    `[bg0][bg1]overlay=0:0[bg01]`,
    `[bg01][bg2]overlay=0:0[bgall]`,
    `[3:v]${fgFit},zoompan=z='min(zoom+0.0008,1.06)':x='iw/2-(iw/zoom/2)+8*sin(on/40)':y='ih/2-(ih/zoom/2)+5*cos(on/35)':d=${frames}:s=${width}x${height}:fps=${fps}[fg]`,
    `[bgall][fg]overlay=0:0[outv]`,
  ].join(';')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
    bgs.forEach((p) => cmd.input(p).inputOptions(['-loop', '1', `-t`, String(duration)]))
    cmd.input(scene.foreground).inputOptions(['-loop', '1', `-t`, String(duration)])

    cmd
      .complexFilter(filter, ['outv'])
      .outputOptions(['-r', String(fps), '-pix_fmt', 'yuv420p', '-t', String(duration)])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

/** Concat scene clips with crossfade transitions. */
async function buildSlideshowFromScenes(
  scenes: VideoScene[],
  aspect: AspectRatio,
  outputPath: string,
): Promise<void> {
  if (scenes.length === 0) throw new Error('No scenes')
  const workDir = path.join(videoWorkDir(), `scenes-${crypto.randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  const clipPaths: string[] = []
  try {
    for (let i = 0; i < scenes.length; i++) {
      const clipPath = path.join(workDir, `scene-${i}.mp4`)
      await buildSceneClip(scenes[i], aspect, clipPath)
      clipPaths.push(clipPath)
    }

    if (clipPaths.length === 1) {
      const { copyFile } = await import('fs/promises')
      await copyFile(clipPaths[0], outputPath)
      return
    }

    const transitionSec = 0.45
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg()
      clipPaths.forEach((p) => cmd.input(p))

      let chain = '[0:v]'
      let cumulative = scenes[0].durationSec
      const xfadeFilters: string[] = []
      for (let i = 1; i < clipPaths.length; i++) {
        const offset = Math.max(0, cumulative - transitionSec * i)
        const outLabel = i === clipPaths.length - 1 ? 'outv' : `x${i}`
        xfadeFilters.push(
          `${chain}[${i}:v]xfade=transition=fadeblack:duration=${transitionSec}:offset=${offset.toFixed(2)}[${outLabel}]`,
        )
        chain = `[${outLabel}]`
        cumulative += scenes[i].durationSec
      }

      cmd
        .complexFilter(xfadeFilters.join(';'), ['outv'])
        .outputOptions(['-r', '25', '-pix_fmt', 'yuv420p'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run()
    })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Mux slideshow + voiceover (+ optional music) + burn-in subtitles + watermark. */
async function combineAudioAndSubtitles(options: {
  slideshowPath: string
  voiceoverPath: string
  musicPath?: string | null
  srtPath: string
  outputPath: string
  aspect: AspectRatio
}): Promise<void> {
  const { slideshowPath, voiceoverPath, musicPath, srtPath, outputPath, aspect } = options
  const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')
  const vertical = aspect === '9:16'
  const forceStyle = vertical
    ? 'FontName=Arial,FontSize=28,PrimaryColour=&H00FFFFFF&,OutlineColour=&H80000000&,BackColour=&H80000000&,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=220,MarginL=48,MarginR=48'
    : 'FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF&,BackColour=&H80000000&,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=52'
  const brandSize = vertical ? 22 : 26
  const brandY = vertical ? 'h-th-160' : 'h-60'
  const siteY = vertical ? 'h-th-200' : 'h-90'

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(slideshowPath).input(voiceoverPath)

    const voiceChain =
      '[1:a]volume=1.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=80[voice]'

    let audioFilter: string
    if (musicPath) {
      cmd.input(musicPath)
      audioFilter =
        `${voiceChain};` +
        '[2:a]aloop=loop=-1:size=2e+09,volume=0.22[music];' +
        '[voice][music]amix=inputs=2:duration=first:dropout_transition=2[outa]'
    } else {
      audioFilter = '[1:a]volume=1.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=80[outa]'
    }

    const videoFilter =
      `[0:v]subtitles='${escapedSrt}':force_style='${forceStyle}'[subbed];` +
      `[subbed]drawtext=text='LEARNCONNECT.NET':fontsize=16:fontcolor=white@0.75:` +
      `x=w-tw-30:y=${siteY}:box=1:boxcolor=black@0.35:boxborderw=6,` +
      `drawtext=text='egitim.today':fontsize=${brandSize}:fontcolor=white:x=w-tw-30:y=${brandY}:` +
      `box=1:boxcolor=black@0.35:boxborderw=6[outv]`

    cmd
      .complexFilter([videoFilter, audioFilter], ['outv', 'outa'])
      .outputOptions(['-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

export type RenderVideoInput = {
  scenes: VideoScene[]
  voiceoverPath: string
  musicPath?: string | null
  srtContent: string
  aspect: AspectRatio
}

/** Legacy flat API — wraps scenes builder. */
export type RenderVideoLegacyInput = {
  imagePaths: string[]
  imageDurations: number[]
  voiceoverPath: string
  musicPath?: string | null
  srtContent: string
  aspect: AspectRatio
}

function legacyToScenes(input: RenderVideoLegacyInput): VideoScene[] {
  return input.imagePaths.map((foreground, i) => {
    const n = input.imagePaths.length
    const prev = input.imagePaths[(i - 1 + n) % n]
    const next = input.imagePaths[(i + 1) % n]
    return {
      foreground,
      backgrounds: [prev, foreground, next],
      durationSec: input.imageDurations[i] || 5,
    }
  })
}

/** Full render: animated multi-layer scenes → mux voiceover/music/subs/watermark → mp4 buffer. */
export async function renderVideo(input: RenderVideoInput | RenderVideoLegacyInput): Promise<Buffer> {
  const { readFile: fsReadFile } = await import('fs/promises')
  const scenes = 'scenes' in input ? input.scenes : legacyToScenes(input)
  const { voiceoverPath, musicPath, srtContent, aspect } = input

  const workDir = path.join(videoWorkDir(), crypto.randomUUID())
  await mkdir(workDir, { recursive: true })

  const slideshowPath = path.join(workDir, 'slideshow.mp4')
  const srtPath = path.join(workDir, 'subs.srt')
  const finalPath = path.join(workDir, 'final.mp4')

  try {
    await writeFile(srtPath, srtContent, 'utf-8')
    await buildSlideshowFromScenes(scenes, aspect, slideshowPath)
    await combineAudioAndSubtitles({
      slideshowPath,
      voiceoverPath,
      musicPath,
      srtPath,
      outputPath: finalPath,
      aspect,
    })
    return await fsReadFile(finalPath)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
