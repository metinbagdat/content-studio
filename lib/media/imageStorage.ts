import { mkdir, writeFile, readFile } from 'fs/promises'
import path from 'path'

export function imageStorageDir(): string {
  return path.join(process.cwd(), 'storage', 'images')
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
