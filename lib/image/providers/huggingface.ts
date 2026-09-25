import type { ImageProvider, ImageGenerateOptions, ImageProviderResult } from './types'
import { bodySnippet, fetchWithRetry, fitDimensions, ProviderRequestError, type RetryOptions } from './http'

/**
 * Hugging Face Inference Providers (text-to-image) via the router:
 *   https://router.huggingface.co/{provider}/...
 * The legacy host api-inference.huggingface.co no longer resolves.
 *
 * HUGGINGFACE_IMAGE_PROVIDER selects the upstream (default `nscale`):
 * - `nscale`       → POST /nscale/v1/images/generations  (OpenAI-style JSON, b64_json)
 * - `hf-inference` → POST /hf-inference/models/{model}   ({ inputs, parameters } → raw image bytes)
 *
 * HUGGINGFACE_IMAGE_MODEL overrides the model. Defaults: FLUX.1-schnell (Apache-2.0, not gated)
 * for nscale; stable-diffusion-3-medium-diffusers for hf-inference (gated — accept the licence
 * on the model page first). Auth: HF_TOKEN with the "Inference Providers" permission.
 */
export const HF_ROUTER_URL = 'https://router.huggingface.co'

export type HfImageProvider = 'nscale' | 'hf-inference'

const DEFAULT_MODELS: Record<HfImageProvider, string> = {
  nscale: 'black-forest-labs/FLUX.1-schnell',
  'hf-inference': 'stabilityai/stable-diffusion-3-medium-diffusers',
}

export const HF_RETRY: RetryOptions = {
  attempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 20_000,
  timeoutMs: 120_000,
}

export function resolveHfConfig(env: NodeJS.ProcessEnv = process.env): { provider: HfImageProvider; model: string } {
  const raw = (env.HUGGINGFACE_IMAGE_PROVIDER || 'nscale').trim().toLowerCase()
  if (raw !== 'nscale' && raw !== 'hf-inference') {
    throw new Error(`HUGGINGFACE_IMAGE_PROVIDER="${raw}" not supported (use "nscale" or "hf-inference")`)
  }
  const provider = raw as HfImageProvider
  const model = env.HUGGINGFACE_IMAGE_MODEL?.trim() || DEFAULT_MODELS[provider]
  return { provider, model }
}

export function buildHfRequest(
  { prompt, width, height, seed }: ImageGenerateOptions,
  env: NodeJS.ProcessEnv = process.env,
): { url: string; body: string; provider: HfImageProvider; model: string } {
  const { provider, model } = resolveHfConfig(env)
  // FLUX / SD3 are trained around 1MP; oversize requests are rejected or slow. Caller resizes anyway.
  const size = fitDimensions(width, height)
  if (provider === 'nscale') {
    return {
      url: `${HF_ROUTER_URL}/nscale/v1/images/generations`,
      body: JSON.stringify({
        model,
        prompt,
        size: `${size.width}x${size.height}`,
        n: 1,
        response_format: 'b64_json',
      }),
      provider,
      model,
    }
  }
  const parameters: Record<string, number> = { width: size.width, height: size.height }
  if (seed !== undefined) parameters.seed = seed
  return {
    url: `${HF_ROUTER_URL}/hf-inference/models/${model}`,
    body: JSON.stringify({ inputs: prompt, parameters }),
    provider,
    model,
  }
}

function hintFor(status: number, model: string): string {
  if (status === 401) return ' (HF_TOKEN invalid or missing "Inference Providers" permission)'
  if (status === 402) return ' (Inference Providers credits exhausted)'
  if (status === 403) return ` (no access — gated model? accept the licence for ${model} or pick another model)`
  if (status === 404) return ` (model ${model} not served by this provider)`
  return ''
}

export const huggingfaceProvider: ImageProvider = {
  name: 'huggingface',
  isAvailable() {
    return Boolean(process.env.HF_TOKEN)
  },
  async generate(options: ImageGenerateOptions): Promise<ImageProviderResult> {
    const key = process.env.HF_TOKEN
    if (!key) throw new Error('HF_TOKEN not set')

    const { url, body, provider, model } = buildHfRequest(options)
    const label = `${provider}/${model}`
    let outcome
    try {
      outcome = await fetchWithRetry(
        url,
        { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body },
        HF_RETRY,
      )
    } catch (err) {
      throw new ProviderRequestError(`HuggingFace (${label}) ${err instanceof Error ? err.message : String(err)}`)
    }
    const { res, attempts } = outcome

    if (!res.ok) {
      const snippet = await bodySnippet(res)
      throw new ProviderRequestError(
        `HuggingFace ${res.status} ${res.statusText}`.trim() +
          `${hintFor(res.status, model)} [${label}, ${attempts} attempt(s)]` +
          (snippet ? `: ${snippet}` : ''),
        res.status,
      )
    }

    if (provider === 'nscale') {
      const data = (await res.json().catch(() => null)) as { data?: Array<{ b64_json?: string }> } | null
      const b64 = data?.data?.[0]?.b64_json
      if (!b64) throw new ProviderRequestError(`HuggingFace (${label}) malformed response: missing data[0].b64_json`)
      return { buffer: Buffer.from(b64, 'base64'), provider: 'huggingface', model }
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType && !contentType.startsWith('image/')) {
      const snippet = await bodySnippet(res)
      throw new ProviderRequestError(`HuggingFace (${label}) returned non-image content-type "${contentType}": ${snippet}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), provider: 'huggingface', model }
  },
}
