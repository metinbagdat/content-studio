import type { ImageProvider, ImageGenerateOptions, ImageProviderResult } from './types'

const BASE_URL = 'https://image.pollinations.ai/prompt'

export const pollinationsProvider: ImageProvider = {
  name: 'pollinations',
  isAvailable() {
    return true // no API key required
  },
  async generate({ prompt, width, height, seed }: ImageGenerateOptions): Promise<ImageProviderResult> {
    const encoded = encodeURIComponent(prompt)
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      nologo: 'true',
    })
    if (seed !== undefined) params.set('seed', String(seed))

    const url = `${BASE_URL}/${encoded}?${params.toString()}`
    const res = await fetch(url, { headers: { 'User-Agent': 'ContentStudio/1.0' } })
    if (!res.ok) throw new Error(`Pollinations ${res.status}`)

    const arrayBuffer = await res.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), provider: 'pollinations' }
  },
}