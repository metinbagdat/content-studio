import { existsSync } from 'fs'
import { arch, platform } from 'os'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

let configured = false

function binaryRelPath(exe: string): string {
  const os = platform()
  const cpu = arch() === 'x64' ? 'x64' : arch()
  if (os === 'win32') return path.join('bin', 'win32', cpu, exe)
  if (os === 'darwin') return path.join('bin', os, cpu, exe)
  return path.join('bin', 'linux', cpu, exe)
}

function resolvePkgBinary(pkg: 'ffmpeg-static' | 'ffprobe-static'): string | null {
  const exe =
    pkg === 'ffmpeg-static'
      ? platform() === 'win32'
        ? 'ffmpeg.exe'
        : 'ffmpeg'
      : platform() === 'win32'
        ? 'ffprobe.exe'
        : 'ffprobe'
  const root = path.join(process.cwd(), 'node_modules', pkg)
  const candidates = [
    path.join(root, exe),
    path.join(root, binaryRelPath(exe)),
  ]
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exported = require(pkg) as { path?: string } | string
    const fromPkg = typeof exported === 'string' ? exported : exported.path
    if (fromPkg) candidates.unshift(fromPkg)
  } catch {
    /* package missing or no path export */
  }
  return candidates.find((p) => existsSync(p)) ?? null
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
