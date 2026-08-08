import ffmpeg from 'fluent-ffmpeg'
import ffprobeStaticPkg from 'ffprobe-static'

// Defensive: some bundlers/TS interop settings wrap the CJS export differently
// (ffprobeStaticPkg.path vs ffprobeStaticPkg.default.path) — try both.
const resolvedPath =
  (typeof (ffprobeStaticPkg as any)?.path === 'string' && (ffprobeStaticPkg as any).path) ||
  (typeof (ffprobeStaticPkg as any)?.default?.path === 'string' && (ffprobeStaticPkg as any).default.path) ||
  null

if (resolvedPath) {
  ffmpeg.setFfprobePath(resolvedPath)
} else {
  console.warn('[audioDuration] could not resolve ffprobe-static path, resolved value:', ffprobeStaticPkg)
}

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