import type { ImageProvider, ImageGenerateOptions, ImageProviderResult } from './types'

const HF_MODEL = process.env.HUGGINGFACE_IMAGE_MODEL || 'stabilityai/stable-diffusion-xl-base-1.0'
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`

/** HF free inference API cold-starts models; retry once on 503 with the model's estimated wait. */
async function callWithColdStartRetry(body: string, key: string): Promise<Response> {
  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body,
  })
  if (res.status !== 503) return res

  const data = await res.json().catch(() => ({}) as { estimated_time?: number })
  const waitMs = Math.min(Math.round((data.estimated_time || 15) * 1000), 25_000)
  await new Promise((r) => setTimeout(r, waitMs))

  return fetch(HF_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body,
  })
}

export const huggingfaceProvider: ImageProvider = {
  name: 'huggingface',
  isAvailable() {
    return Boolean(process.env.HF_TOKEN)
  },
  async generate({ prompt, width, height }: ImageGenerateOptions): Promise<ImageProviderResult> {
    const key = process.env.HF_TOKEN
    if (!key) throw new Error('HF_TOKEN not set')

    const body = JSON.stringify({ inputs: prompt, parameters: { width, height } })
    const res = await callWithColdStartRetry(body, key)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HuggingFace ${res.status}: ${text.slice(0, 200)}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), provider: 'huggingface', model: HF_MODEL }
  },
}