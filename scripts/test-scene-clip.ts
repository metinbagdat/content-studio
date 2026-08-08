import { mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { videoWorkDir } from '../lib/video/videoStorage'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

async function main() {
  const imgPath = path.join(process.cwd(), 'storage', 'images', 'test-scene.png')
  await sharp({ create: { width: 1280, height: 720, channels: 3, background: { r: 40, g: 60, b: 120 } } })
    .png()
    .toFile(imgPath)

  const { width, height } = { width: 1920, height: 1080 }
  const fps = 25
  const duration = 5.45
  const frames = Math.ceil(duration * fps)
  const bgFill = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
  const fgFit = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a0a12`
  const filter = [
    `[0:v]${bgFill},boxblur=28:8,eq=brightness=-0.38,zoompan=z='min(zoom+0.0012,1.3)':x='iw/2-(iw/zoom/2)+25*sin(on/25)':y='ih/2-(ih/zoom/2)+12*cos(on/30)':d=${frames}:s=${width}x${height}:fps=${fps}[bg0]`,
    `[1:v]${bgFill},boxblur=16:4,eq=brightness=-0.22,zoompan=z='max(1.2-on*0.0008,1.0)':x='iw/2-(iw/zoom/2)+30*sin(on/28)':y='ih/2-(ih/zoom/2)+18*cos(on/32)':d=${frames}:s=${width}x${height}:fps=${fps}[bg1]`,
    `[2:v]${bgFill},boxblur=8:2,eq=brightness=-0.08,zoompan=z='min(zoom+0.0018,1.4)':x='iw/2-(iw/zoom/2)-20*cos(on/22)':y='ih/2-(ih/zoom/2)+10*sin(on/26)':d=${frames}:s=${width}x${height}:fps=${fps}[bg2]`,
    `[bg0][bg1]overlay=0:0[bg01]`,
    `[bg01][bg2]overlay=0:0[bgall]`,
    `[3:v]${fgFit},fps=${fps}[fg]`,
    `[bgall][fg]overlay=0:0[outv]`,
  ].join(';')

  const workDir = path.join(videoWorkDir(), 'debug-scene')
  await mkdir(workDir, { recursive: true })
  const outputPath = path.join(workDir, 'scene-0.mp4')

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg()
    ;[imgPath, imgPath, imgPath, imgPath].forEach((p) =>
      cmd.input(p).inputOptions(['-loop', '1', '-t', String(duration)]),
    )
    cmd
      .complexFilter(filter, ['outv'])
      .outputOptions(['-r', String(fps), '-pix_fmt', 'yuv420p', '-t', String(duration)])
      .output(outputPath)
      .on('start', (c) => console.log('CMD:', c))
      .on('stderr', (l) => console.log('stderr:', l))
      .on('end', () => resolve())
      .on('error', (e) => reject(e))
      .run()
  })
  console.log('Wrote', outputPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
