import ffmpeg from 'fluent-ffmpeg'
import { configureFfmpeg } from '@/lib/media/ffmpegPaths'

configureFfmpeg()

/** Real duration (seconds) of an audio file via ffprobe — drives subtitle/image timing instead of estimates. */
export function getAudioDurationSec(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err)
      const duration = data.format.duration
      if (!duration) return reject(new Error('ffprobe: no duration found'))
      resolve(duration)
    })
  })
}