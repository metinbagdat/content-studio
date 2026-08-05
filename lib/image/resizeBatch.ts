import sharp from 'sharp'
import {
  PLATFORM_IMAGE_SIZES,
  type ImageSpec,
  type PlatformImageKey,
} from './platformSizes'

export type ResizeOptions = {
  format?: 'jpeg' | 'png'
  /** JPEG quality 1–100 (ignored for PNG). */
  quality?: number
}

export type ResizedPlatformImage = {
  key: PlatformImageKey
  spec: ImageSpec
  buffer: Buffer
  format: 'jpeg' | 'png'
  fileSize: number
}

const DEFAULT_EXPORT_KEYS: PlatformImageKey[] = [
  'linkedinPost',
  'twitterPost',
  'instagramPost',
  'instagramStory',
  'facebookPost',
  'pinterestPin',
  'youtubeThumbnail',
  'tiktokVertical',
]

/** Crop/resize a master image to one platform spec. */
export async function resizeToPlatform(
  master: Buffer,
  key: PlatformImageKey,
  options: ResizeOptions = {},
): Promise<ResizedPlatformImage> {
  const spec = PLATFORM_IMAGE_SIZES[key]
  const format = options.format ?? 'jpeg'
  const quality = options.quality ?? 85

  let pipeline = sharp(master).rotate().resize(spec.width, spec.height, {
    fit: 'cover',
    position: 'centre',
  })

  const buffer =
    format === 'jpeg'
      ? await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
      : await pipeline.png({ compressionLevel: 9 }).toBuffer()

  return { key, spec, buffer, format, fileSize: buffer.length }
}

/** Derive all (or selected) platform sizes from one master photo. */
export async function batchExportPlatformSizes(
  master: Buffer,
  keys: PlatformImageKey[] = DEFAULT_EXPORT_KEYS,
  options: ResizeOptions = {},
): Promise<ResizedPlatformImage[]> {
  const out: ResizedPlatformImage[] = []
  for (const key of keys) {
    out.push(await resizeToPlatform(master, key, options))
  }
  return out
}
