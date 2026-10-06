import { mkdir, writeFile, readFile, access } from 'fs/promises'
import path from 'path'
import { storageSubdir, isServerlessRuntime } from '../storage/writableRoot'
import { isDurableMediaUrl } from '../video/videoStorage'

export function audioStorageDir(): string {
  return storageSubdir('audio')
}

export async function writeAudioFile(filename: string, data: Buffer): Promise<string> {
  const dir = audioStorageDir()
  await mkdir(dir, { recursive: true })
  const full = path.join(dir, filename)
  await writeFile(full, data)
  return full
}

export function audioDiskPath(filename: string): string {
  return path.join(audioStorageDir(), filename)
}

export async function readAudioFile(filename: string): Promise<Buffer> {
  return readFile(audioDiskPath(filename))
}

export function publicMediaAudioUrl(mediaId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3100'
  return `${base}/api/media/${mediaId}/file`
}

export function blobAudioUploadEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) || isServerlessRuntime()
}

/**
 * Persist a generated MP3 and return the URL admin / prod should use.
 *
 * - Always write `storage/audio/{id}.mp3` (or `/tmp/...` on Vercel) so same-request
 *   FFmpeg (podcast video) can read a real path — MP3s are small unlike MP4.
 * - When `BLOB_READ_WRITE_TOKEN` is set (local or Vercel): also `put` to `audio/{id}.mp3`
 *   and return the Blob CDN URL so later invocations survive ephemeral `/tmp`.
 * - Studio `/api/media/.../file` must 302 to Blob when durable — never proxy MP3
 *   bytes on Vercel (egress), matching the video route.
 */
export async function persistGeneratedAudio(mediaId: string, data: Buffer): Promise<string> {
  await writeAudioFile(`${mediaId}.mp3`, data)

  if (blobAudioUploadEnabled()) {
    const { put } = await import('@vercel/blob')
    // Prefer static RW token locally: OIDC often targets Production only and fails with
    // "OIDC is enabled… not for the development environment".
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
    const blob = await put(`audio/${mediaId}.mp3`, data, {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: false,
      ...(token ? { token } : {}),
    })
    return blob.url
  }

  return publicMediaAudioUrl(mediaId)
}

/**
 * Local path for FFmpeg (podcast video, etc.): disk first, else download durable Blob URL once.
 */
export async function ensureAudioDiskPath(input: {
  mediaId: string
  publicUrl?: string | null
}): Promise<string> {
  const diskPath = audioDiskPath(`${input.mediaId}.mp3`)
  try {
    await access(diskPath)
    return diskPath
  } catch {
    /* fall through */
  }

  if (!isDurableMediaUrl(input.publicUrl)) {
    throw new Error(
      `Audio yok (disk + Blob): ${input.mediaId} — yerelde üretip BLOB_READ_WRITE_TOKEN ile yükleyin`,
    )
  }

  const res = await fetch(input.publicUrl!, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) {
    throw new Error(`Blob audio fetch HTTP ${res.status} (${input.mediaId})`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeAudioFile(`${input.mediaId}.mp3`, buf)
  return diskPath
}

export { isDurableMediaUrl }
