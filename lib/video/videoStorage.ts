import { mkdir, writeFile, readFile } from 'fs/promises'
import path from 'path'
import { storageSubdir, isServerlessRuntime } from '../storage/writableRoot'

export function videoStorageDir(): string {
  return storageSubdir('videos')
}

export function videoWorkDir(): string {
  return storageSubdir('video-work')
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

/** Absolute HTTPS CDN URL — not studio /api/media self-fetch (ephemeral on Vercel). */
export function isDurableMediaUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  if (!/^https:\/\//i.test(url.trim())) return false
  if (url.includes('/api/media/')) return false
  return true
}

export function blobVideoUploadEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) || isServerlessRuntime()
}

/**
 * Persist an MP4 and return the URL platforms / prod should use.
 *
 * - Local: always write `storage/videos/{id}.mp4` (FFmpeg + buffer upload from disk).
 * - When `BLOB_READ_WRITE_TOKEN` is set (local or Vercel): also `put` to `videos/{id}.mp4`
 *   and return the Blob CDN URL so prod can publish without this machine's disk.
 * - Studio `/api/media/.../video` must only 302 to Blob — never proxy MP4 bytes (egress).
 */
export async function persistGeneratedVideo(mediaId: string, data: Buffer): Promise<string> {
  if (!isServerlessRuntime()) {
    await writeVideoFile(`${mediaId}.mp4`, data)
  }

  if (blobVideoUploadEnabled()) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`videos/${mediaId}.mp4`, data, {
      access: 'public',
      contentType: 'video/mp4',
      addRandomSuffix: false,
    })
    return blob.url
  }

  return publicMediaVideoUrl(mediaId)
}

/**
 * Bytes for YouTube/TikTok buffer upload: disk first (zero Blob egress), else durable URL fetch.
 * Prefer running buffer publishes on the operator machine when disk exists.
 */
export async function readVideoBufferForPublish(input: {
  mediaId: string
  diskPath: string
  publicUrl: string
}): Promise<Buffer> {
  try {
    return await readFile(input.diskPath)
  } catch {
    if (!isDurableMediaUrl(input.publicUrl)) {
      throw new Error(
        `Video yok (disk + Blob): ${input.mediaId} — yerelde üretip BLOB_READ_WRITE_TOKEN ile yükleyin`,
      )
    }
    const res = await fetch(input.publicUrl, { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) {
      throw new Error(`Blob video fetch HTTP ${res.status} (${input.mediaId})`)
    }
    return Buffer.from(await res.arrayBuffer())
  }
}
