import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import type { AspectRatio } from '../video/renderVideo'
import { dimensionsForAspect } from '../video/renderVideo'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

export function aspectFromDimensions(width: number, height: number): AspectRatio {
  const ratio = width / height
  if (ratio > 1.2) return '16:9'
  if (ratio < 0.85) return '9:16'
  return '1:1'
}

/** Render a short Ken Burns clip from a still image (social cards, thumbnails). */
export async function renderKenBurnsClip(options: {
  imagePath: string
  outputPath: string
  aspect: AspectRatio
  durationSec?: number
}): Promise<void> {
  const duration = options.durationSec ?? 6
  const fps = 25
  const frames = Math.max(25, Math.ceil(duration * fps))
  const { width, height } = dimensionsForAspect(options.aspect)

  const fit = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a0a12`
  const filter =
    `[0:v]${fit},` +
    `zoompan=z='min(zoom+0.0015,1.12)':` +
    `x='iw/2-(iw/zoom/2)+14*sin(on/30)':` +
    `y='ih/2-(ih/zoom/2)+9*cos(on/28)':` +
    `d=${frames}:s=${width}x${height}:fps=${fps}[outv]`

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(options.imagePath)
      .inputOptions(['-loop', '1', '-t', String(duration)])
      .complexFilter(filter, ['outv'])
      .outputOptions([
        '-r',
        String(fps),
        '-pix_fmt',
        'yuv420p',
        '-t',
        String(duration),
        '-movflags',
        '+faststart',
      ])
      .output(options.outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

export function socialAnimationEnabled(): boolean {
  return process.env.SOCIAL_ANIMATED_POSTS !== 'false'
}
