import { mkdir, writeFile, readFile } from 'fs/promises'
import path from 'path'
import { storageSubdir } from '../storage/writableRoot'
import { isServerlessRuntime } from '../storage/writableRoot'

export function imageStorageDir(): string {
  return storageSubdir('images')
}

export async function writeImageFile(filename: string, data: Buffer): Promise<string> {
  const dir = imageStorageDir()
  await mkdir(dir, { recursive: true })
  const full = path.join(dir, filename)
  await writeFile(full, data)
  return full
}

export function imageDiskPath(filename: string): string {
  return path.join(imageStorageDir(), filename)
}

export async function readImageFile(filename: string): Promise<Buffer> {
  return readFile(imageDiskPath(filename))
}

export function publicMediaImageUrl(mediaId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3100'
  return `${base}/api/media/${mediaId}/image`
}

/**
 * Persist a generated image and return its final, publicly reachable URL.
 *
 * On Vercel: uploads to Vercel Blob and returns Blob's own permanent CDN URL.
 * This is the fix for the "/tmp self-fetch 404" bug — Vercel's /tmp is
 * ephemeral and not reliably readable back via a self-referential HTTP
 * request from a different serverless instance, which was causing image
 * publish failures across SOCIAL_CAPTION / INFOGRAPHIC / LINKEDIN_CAROUSEL.
 *
 * Locally: unchanged — writes to disk and returns the existing
 * `/api/media/{id}/image` route URL, which works fine locally since one
 * long-running dev server process serves every request.
 */
export async function persistGeneratedImage(
  mediaId: string,
  data: Buffer,
  format: 'png' | 'jpeg' = 'png',
): Promise<string> {
  if (isServerlessRuntime()) {
    const { put } = await import('@vercel/blob')
    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    const blob = await put(`images/${mediaId}.${format}`, data, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    })
    return blob.url
  }
  await writeImageFile(`${mediaId}.${format}`, data)
  return publicMediaImageUrl(mediaId)
}