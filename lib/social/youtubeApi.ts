import { readFile } from 'fs/promises'
import type { ContentType } from '@prisma/client'
import { buildYouTubeMetadata } from './publishVideo'

export type YouTubeChannel = {
  id: string
  title: string
  customUrl?: string
  thumbnailUrl?: string
}

export type YouTubeTestResult = {
  ok: boolean
  channel?: YouTubeChannel
  quotaNote?: string
  error?: string
}

export type YouTubeUploadInput = {
  accessToken: string
  videoPath: string
  title: string
  description: string
  tags?: string[]
  privacyStatus?: 'public' | 'unlisted' | 'private'
  categoryId?: string
  isShort?: boolean
}

export type YouTubeUploadResult = {
  videoId: string
}

/** Verify OAuth token and return the authenticated YouTube channel. */
export async function fetchYouTubeChannel(accessToken: string): Promise<YouTubeChannel> {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube channels.list ${res.status}: ${body.slice(0, 240)}`)
  }
  const json = (await res.json()) as {
    items?: Array<{
      id: string
      snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } }
    }>
  }
  const item = json.items?.[0]
  if (!item?.id) {
    throw new Error('YouTube kanalı bulunamadı — önce YouTube Studio ile kanal oluşturun')
  }
  return {
    id: item.id,
    title: item.snippet?.title || item.id,
    customUrl: item.snippet?.customUrl,
    thumbnailUrl: item.snippet?.thumbnails?.default?.url,
  }
}

export async function testYouTubeConnection(accessToken: string): Promise<YouTubeTestResult> {
  try {
    const channel = await fetchYouTubeChannel(accessToken)
    return {
      ok: true,
      channel,
      quotaNote: 'OAuth OK — video upload publish pipeline\'a bağlı.',
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Resumable upload — single PUT for generated MP4s (typically < 500 MB). */
export async function uploadYouTubeVideo(input: YouTubeUploadInput): Promise<YouTubeUploadResult> {
  const {
    accessToken,
    videoPath,
    title,
    description,
    tags = [],
    privacyStatus = 'public',
    categoryId = '27',
    isShort = false,
  } = input

  let finalTitle = title.slice(0, 100)
  let finalDescription = description
  if (isShort && !finalTitle.includes('#Shorts')) {
    finalTitle = `${finalTitle.slice(0, 93)} #Shorts`.slice(0, 100)
  }
  if (isShort && !finalDescription.includes('#Shorts')) {
    finalDescription = `${finalDescription}\n\n#Shorts`.slice(0, 5000)
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify({
        snippet: {
          title: finalTitle,
          description: finalDescription,
          tags: tags.slice(0, 30),
          categoryId,
          defaultLanguage: 'tr',
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  )

  if (!initRes.ok) {
    const body = await initRes.text()
    throw new Error(`YouTube upload init ${initRes.status}: ${body.slice(0, 400)}`)
  }

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube upload URL alınamadı')

  const videoBuffer = await readFile(videoPath)
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/*',
      'Content-Length': String(videoBuffer.length),
    },
    body: new Uint8Array(videoBuffer),
  })

  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    throw new Error(`YouTube upload ${uploadRes.status}: ${body.slice(0, 400)}`)
  }

  const result = (await uploadRes.json()) as { id?: string }
  if (!result.id) throw new Error('YouTube video ID döndürülmedi')
  return { videoId: result.id }
}

export async function setYouTubeThumbnail(
  accessToken: string,
  videoId: string,
  imageBuffer: Buffer,
  contentType = 'image/png',
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
        'Content-Length': String(imageBuffer.length),
      },
      body: new Uint8Array(imageBuffer),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube thumbnail ${res.status}: ${body.slice(0, 240)}`)
  }
}

export function youtubeMetadataFromDerived(input: {
  title: string
  content: string
  contentType: ContentType
  metadata?: unknown
  sourceTitle?: string
}): { title: string; description: string; tags: string[]; isShort: boolean } {
  return buildYouTubeMetadata(input)
}
