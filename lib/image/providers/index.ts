import type { ImageGenerateOptions, ImageProvider, ImageProviderResult } from './types'
import { pollinationsProvider } from './pollinations'
import { huggingfaceProvider } from './huggingface'
import { localSdProvider } from './localSD'

// Priority order: free/keyless first, then free-with-key, then local (once configured).
const PROVIDER_CHAIN: ImageProvider[] = [pollinationsProvider, huggingfaceProvider, localSdProvider]

export async function generateWithFallback(options: ImageGenerateOptions): Promise<ImageProviderResult> {
  const errors: string[] = []
  for (const provider of PROVIDER_CHAIN) {
    if (!(await provider.isAvailable())) continue
    try {
      return await provider.generate(options)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${provider.name}: ${msg}`)
      console.warn(`[image] provider ${provider.name} failed, trying next`, msg)
    }
  }
  throw new Error(`All image providers failed: ${errors.join(' | ')}`)
}