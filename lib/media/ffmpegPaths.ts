import { existsSync } from 'fs'
import { createRequire } from 'module'
import { arch, platform } from 'os'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

const requireFromHere = createRequire(__filename)

let configured = false

function binaryRelPath(exe: string): string {
  const os = platform()
  const cpu = arch() === 'x64' ? 'x64' : arch()
  if (os === 'win32') return path.join('bin', 'win32', cpu, exe)
  if (os === 'darwin') return path.join('bin', os, cpu, exe)
  return path.join('bin', 'linux', cpu, exe)
}

/** Walk up from cwd / this file until monorepo root with node_modules/ffmpeg-static. */
function resolveRepoRoot(): string {
  const starts = [process.cwd(), path.dirname(__filename)]
  for (const start of starts) {
    let dir = start
    for (let i = 0; i < 8; i++) {
      if (existsSync(path.join(dir, 'node_modules', 'ffmpeg-static'))) return dir
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return process.cwd()
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

  const root = path.join(resolveRepoRoot(), 'node_modules', pkg)
  const candidates: string[] = []

  if (process.env.FFMPEG_PATH && pkg === 'ffmpeg-static') {
    candidates.push(process.env.FFMPEG_PATH)
  }
  if (process.env.FFPROBE_PATH && pkg === 'ffprobe-static') {
    candidates.push(process.env.FFPROBE_PATH)
  }

  try {
    const exported = requireFromHere(pkg) as { path?: string } | string
    const fromPkg = typeof exported === 'string' ? exported : exported?.path
    if (fromPkg) candidates.push(fromPkg)
  } catch {
    /* package missing */
  }

  candidates.push(path.join(root, exe), path.join(root, binaryRelPath(exe)))

  return candidates.find((p) => p && existsSync(p)) ?? null
}

/** Idempotent — resolves binaries from node_modules (Next cwd may be apps/web). */
export function configureFfmpeg(): void {
  if (configured) return

  const ffmpegPath = resolvePkgBinary('ffmpeg-static')
  const ffprobePath = resolvePkgBinary('ffprobe-static')

  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath)
  } else {
    console.warn(
      '[ffmpegPaths] ffmpeg not found — npm i ffmpeg-static or set FFMPEG_PATH. cwd=',
      process.cwd(),
      'root=',
      resolveRepoRoot(),
    )
  }
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath)
  } else {
    console.warn('[ffmpegPaths] ffprobe-static binary not found')
  }

  // Only lock after a successful ffmpeg resolve so a bad first cwd can retry.
  if (ffmpegPath) configured = true
}

export function getFfmpegBinaryPath(): string | null {
  configureFfmpeg()
  return resolvePkgBinary('ffmpeg-static')
}
