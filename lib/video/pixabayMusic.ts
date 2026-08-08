import { readdir, mkdir, access } from 'fs/promises'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

function musicLibraryDir(): string {
  return path.join(process.cwd(), 'storage', 'music-library')
}

const MOOD_FOLDERS: Record<string, string> = {
  'marching band anthem, uplifting, orchestral': 'marching',
  'inspiring corporate': 'uplifting',
  'pop, uplifting, motivational': 'uplifting',
  calm: 'calm',
}

function resolveFolder(mood: string): string {
  return MOOD_FOLDERS[mood] || 'uplifting'
}

/** Generate a soft ambient bed when no local tracks exist — cached for reuse. */
async function generateAmbientTrack(outputPath: string): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true })
  try {
    await access(outputPath)
    return outputPath
  } catch {
    /* generate */
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('anoisesrc=color=pink:duration=240:sample_rate=44100,lowpass=f=700,volume=0.2,afade=t=in:st=0:d=3,afade=t=out:st=237:d=3')
      .inputFormat('lavfi')
      .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k', '-t', '240'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

/** Pick a random local royalty-free track by mood, or generate ambient fallback. */
export async function fetchBackgroundMusic(mood = 'inspiring corporate'): Promise<string> {
  const folder = path.join(musicLibraryDir(), resolveFolder(mood))
  try {
    const files = (await readdir(folder)).filter((f) => f.toLowerCase().endsWith('.mp3'))
    if (files.length) {
      const pick = files[Math.floor(Math.random() * files.length)]
      return path.join(folder, pick)
    }
  } catch {
    /* folder missing */
  }

  const fallback = path.join(musicLibraryDir(), 'uplifting', 'generated-ambient.mp3')
  return generateAmbientTrack(fallback)
}
