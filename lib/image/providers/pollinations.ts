import type { ImageProvider, ImageGenerateOptions, ImageProviderResult } from './types'
import { bodySnippet, fetchWithRetry, ProviderRequestError, type RetryOptions } from './http'

/**
 * Pollinations image generation.
 *
 * - With POLLINATIONS_API_KEY (secret `sk_…` key from https://enter.pollinations.ai):
 *   authenticated API `GET https://gen.pollinations.ai/image/{prompt}` with
 *   `Authorization: Bearer <key>` (see https://gen.pollinations.ai/docs). Optional
 *   POLLINATIONS_IMAGE_MODEL picks the model (server default otherwise).
 * - Without a key: legacy anonymous `https://image.pollinations.ai/prompt/{prompt}`,
 *   which is heavily rate-limited (429) at larger sizes.
 */
export const POLLINATIONS_AUTH_BASE_URL = 'https://gen.pollinations.ai/image'
export const POLLINATIONS_ANON_BASE_URL = 'https://image.pollinations.ai/prompt'

export const POLLINATIONS_RETRY: RetryOptions = {
  attempts: 3,
  baseDelayMs: 1500,
  maxDelayMs: 10_000,
  timeoutMs: 90_000,
}

export function buildPollinationsRequest(
  { prompt, width, height, seed }: ImageGenerateOptions,
  env: NodeJS.ProcessEnv = process.env,
): { url: string; headers: Record<string, string>; authenticated: boolean; model?: string } {
  const key = env.POLLINATIONS_API_KEY?.trim()
  const model = env.POLLINATIONS_IMAGE_MODEL?.trim() || undefined
  const params = new URLSearchParams({ width: String(width), height: String(height) })
  if (seed !== undefined) params.set('seed', String(seed))
  const headers: Record<string, string> = { 'User-Agent': 'ContentStudio/1.0' }
  const encoded = encodeURIComponent(prompt)

  if (key) {
    if (model) params.set('model', model)
    headers.Authorization = `Bearer ${key}`
    return { url: `${POLLINATIONS_AUTH_BASE_URL}/${encoded}?${params}`, headers, authenticated: true, model }
  }

  params.set('nologo', 'true')
  if (model) params.set('model', model)
  return { url: `${POLLINATIONS_ANON_BASE_URL}/${encoded}?${params}`, headers, authenticated: false, model }
}

function hintFor(status: number, authenticated: boolean): string {
  if (status === 401) return ' (POLLINATIONS_API_KEY missing/invalid)'
  if (status === 402) return ' (pollen balance / key budget exhausted)'
  if (status === 429 && !authenticated) return ' (anonymous tier rate-limited; set POLLINATIONS_API_KEY)'
  return ''
}

export const pollinationsProvider: ImageProvider = {
  name: 'pollinations',
  isAvailable() {
    return true // anonymous fallback works without a key
  },
  async generate(options: ImageGenerateOptions): Promise<ImageProviderResult> {
    const { url, headers, authenticated, model } = buildPollinationsRequest(options)
    const mode = authenticated ? 'gen.pollinations.ai, authenticated' : 'image.pollinations.ai, anonymous'

    let outcome
    try {
      outcome = await fetchWithRetry(url, { headers }, POLLINATIONS_RETRY)
    } catch (err) {
      throw new ProviderRequestError(`Pollinations (${mode}) ${err instanceof Error ? err.message : String(err)}`)
    }
    const { res, attempts } = outcome

    if (!res.ok) {
      const snippet = await bodySnippet(res)
      throw new ProviderRequestError(
        `Pollinations ${res.status} ${res.statusText}`.trim() +
          `${hintFor(res.status, authenticated)} [${mode}, ${attempts} attempt(s)]` +
          (snippet ? `: ${snippet}` : ''),
        res.status,
      )
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType && !contentType.startsWith('image/')) {
      const snippet = await bodySnippet(res)
      throw new ProviderRequestError(`Pollinations returned non-image content-type "${contentType}" [${mode}]: ${snippet}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength === 0) throw new ProviderRequestError(`Pollinations returned an empty body [${mode}]`)
    return { buffer: Buffer.from(arrayBuffer), provider: 'pollinations', model }
  },
}
