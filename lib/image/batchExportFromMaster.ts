import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { publicMediaImageUrl, writeImageFile, readImageFile, imageDiskPath } from '../media/imageStorage'
import { readFile } from 'fs/promises'
import {
  batchExportPlatformSizes,
  type ResizedPlatformImage,
  type ResizeOptions,
} from './resizeBatch'
import type { PlatformImageKey } from './platformSizes'

export type PlatformExportResult = {
  masterMediaId: string
  exports: Array<{
    mediaId: string
    key: PlatformImageKey
    label: string
    publicUrl: string
    fileSize: number
    format: string
  }>
}

async function readMasterBuffer(mediaId: string, format: string): Promise<Buffer> {
  const ext = format === 'jpeg' ? 'jpg' : format
  try {
    return await readImageFile(`${mediaId}.${ext}`)
  } catch {
    return readFile(imageDiskPath(`${mediaId}.png`))
  }
}

/** Resize one master IMAGE MediaFile into platform-sized derivatives. */
export async function batchExportFromMasterMedia(
  masterMediaId: string,
  options: {
    keys?: PlatformImageKey[]
    format?: ResizeOptions['format']
    quality?: number
  } = {},
): Promise<PlatformExportResult> {
  const master = await prisma.mediaFile.findUnique({
    where: { id: masterMediaId },
    include: { derivedContent: true },
  })
  if (!master || master.mediaType !== 'IMAGE' || master.processingStatus !== 'COMPLETED') {
    throw new Error('Geçerli bir IMAGE medya dosyası gerekli (COMPLETED)')
  }

  const masterBuffer = await readMasterBuffer(master.id, master.format)
  const resized = await batchExportPlatformSizes(masterBuffer, options.keys, {
    format: options.format,
    quality: options.quality,
  })

  const exports: PlatformExportResult['exports'] = []

  for (const item of resized) {
    const row = await createExportMediaFile(master.derivedContentId, item, masterMediaId)
    exports.push(row)
  }

  const meta =
    master.derivedContent.metadata && typeof master.derivedContent.metadata === 'object'
      ? (master.derivedContent.metadata as Record<string, unknown>)
      : {}

  await prisma.derivedContent.update({
    where: { id: master.derivedContentId },
    data: {
      metadata: {
        ...meta,
        platformImageExports: exports,
        platformExportMasterId: masterMediaId,
        platformExportAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  })

  return { masterMediaId, exports }
}

async function createExportMediaFile(
  derivedContentId: string,
  item: ResizedPlatformImage,
  masterMediaId: string,
): Promise<PlatformExportResult['exports'][number]> {
  const ext = item.format === 'jpeg' ? 'jpg' : 'png'
  const media = await prisma.mediaFile.create({
    data: {
      derivedContentId,
      mediaType: 'IMAGE',
      fileUrl: '',
      format: item.format,
      processingStatus: 'PROCESSING',
    },
  })

  try {
    await writeImageFile(`${media.id}.${ext}`, item.buffer)
    const publicUrl = publicMediaImageUrl(media.id)
    await prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        fileUrl: publicUrl,
        fileSize: item.fileSize,
        processingStatus: 'COMPLETED',
      },
    })

    const derived = await prisma.derivedContent.findUnique({ where: { id: derivedContentId } })
    const meta =
      derived?.metadata && typeof derived.metadata === 'object'
        ? (derived.metadata as Record<string, unknown>)
        : {}
    await prisma.derivedContent.update({
      where: { id: derivedContentId },
      data: {
        metadata: {
          ...meta,
          [`export_${media.id}`]: {
            platformKey: item.key,
            masterMediaId,
            label: item.spec.label,
            aspectRatio: item.spec.aspectRatio,
          },
        } as Prisma.InputJsonValue,
      },
    })

    return {
      mediaId: media.id,
      key: item.key,
      label: item.spec.label,
      publicUrl,
      fileSize: item.fileSize,
      format: item.format,
    }
  } catch (err) {
    await prisma.mediaFile.update({
      where: { id: media.id },
      data: { processingStatus: 'FAILED' },
    })
    throw err
  }
}
