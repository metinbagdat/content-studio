import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { isDurableMediaUrl } from '../video/videoStorage'
import { isServerlessRuntime } from '../storage/writableRoot'

export type TtsMode = 'openai' | 'edge' | 'none'

export function ttsModeLabel(): string {
  const mode = resolveTtsMode()
  if (mode === 'openai') return 'OpenAI TTS'
  if (mode === 'edge') return 'Edge TTS (ücretsiz)'
  return 'none'
}

export function resolveTtsMode(): TtsMode {
  const forced = process.env.TTS_PROVIDER?.toLowerCase()
  if (forced === 'openai' && process.env.OPENAI_API_KEY) return 'openai'
  if (forced === 'edge') return 'edge'
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL?.includes('groq.com')) {
    return 'openai'
  }
  return 'edge'
}

export async function synthesizeSpeech(text: string, voiceOverride?: string): Promise<Buffer> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('TTS metni boş')

  const mode = resolveTtsMode()
  if (mode === 'openai') return openAiTts(trimmed, voiceOverride)
  return edgeTts(trimmed, voiceOverride)
}

async function openAiTts(text: string, voiceOverride?: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY gerekli (TTS_PROVIDER=openai)')
  const base = process.env.OPENAI_BASE_URL?.replace(/\/$/, '') || 'https://api.openai.com/v1'
  const model = process.env.TTS_MODEL || 'tts-1'
  const voice = voiceOverride || process.env.TTS_VOICE || 'nova'

  const res = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input: text.slice(0, 4096),
      response_format: 'mp3',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI TTS ${res.status}: ${err.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function edgeTts(text: string, voiceOverride?: string): Promise<Buffer> {
  const voice = voiceOverride || process.env.TTS_EDGE_VOICE || 'tr-TR-EmelNeural'
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts')

  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)

  const { audioStream } = await tts.toStream(text.slice(0, 8000))

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    audioStream.on('end', () => resolve())
    audioStream.on('error', reject)
  })

  const buffer = Buffer.concat(chunks)
  if (!buffer.length) throw new Error('Edge TTS ses uretmedi')
  return buffer
}

import { storageSubdir } from '../storage/writableRoot'

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

/** HTTPS CDN URL. Studio `/api/media/.../file` is local disk and is not durable. */
export function isDurableAudioUrl(url: string | null | undefined): boolean {
  return isDurableMediaUrl(url)
}

function blobAudioUploadEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) || isServerlessRuntime()
}

/**
 * Write MP3 locally when not on Vercel, and upload `audio/{id}.mp3` when a Blob
 * token is set. Returns the Blob URL, or the local file route when Blob is off.
 * Does not call TTS.
 */
export async function persistGeneratedAudio(mediaId: string, data: Buffer): Promise<string> {
  if (!isServerlessRuntime()) {
    await writeAudioFile(`${mediaId}.mp3`, data)
  }

  if (blobAudioUploadEnabled()) {
    const { put } = await import('@vercel/blob')
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
    const blob = await put(`audio/${mediaId}.mp3`, data, {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: false,
      ...(token ? { token } : {}),
    })
    return blob.url
  }

  return `/api/media/${mediaId}/file`
}

/** Upload an existing disk MP3. Returns null when the file is not on disk. Blob errors propagate. */
export async function promoteAudioFromDisk(mediaId: string): Promise<string | null> {
  let data: Buffer
  try {
    data = await readFile(audioDiskPath(`${mediaId}.mp3`))
  } catch {
    return null
  }
  if (!data.length) return null
  return persistGeneratedAudio(mediaId, data)
}