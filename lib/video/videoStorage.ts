import { mkdir, writeFile, readFile } from 'fs/promises'
import path from 'path'

export function videoStorageDir(): string {
  return path.join(process.cwd(), 'storage', 'videos')
}

export function videoWorkDir(): string {
  return path.join(process.cwd(), 'storage', 'video-work')
}

export async function writeVideoFile(filename: string, data: Buffer): Promise<string> {
  const dir = videoStorageDir()
  await mkdir(dir, { recursive: true })
  const full = path.join(dir, filename)
  await writeFile(full, data)
  return full
}

export function videoDiskPath(filename: string): string {
  return path.join(videoStorageDir(), filename)
}

export async function readVideoFile(filename: string): Promise<Buffer> {
  return readFile(videoDiskPath(filename))
}

export function publicMediaVideoUrl(mediaId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3100'
  return `${base}/api/media/${mediaId}/video`
}