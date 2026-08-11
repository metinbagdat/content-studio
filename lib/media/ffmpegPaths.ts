import { createRequire } from 'module'
import { existsSync } from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

let configured = false

function resolvePkgBinary(pkg: string): string | null {
  try {
    const require = createRequire(path.join(process.cwd(), 'package.json'))
    const mod = require(pkg) as { path?: string; default?: { path?: string } }
    const candidates = [mod?.path, mod?.default?.path].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    )
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
  } catch {
    /* package missing at runtime */
  }
  return null
}

/** Idempotent — resolves binaries from node_modules (Next vendor-chunks break ffprobe paths). */
export function configureFfmpeg(): void {
  if (configured) return
  configured = true
  const ffmpegPath = resolvePkgBinary('ffmpeg-static')
  const ffprobePath = resolvePkgBinary('ffprobe-static')
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)
  else console.warn('[ffmpegPaths] ffmpeg-static binary not found')
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath)
  else console.warn('[ffmpegPaths] ffprobe-static binary not found')
}
