import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deps, describeFetchError, fitDimensions, parseRetryAfterMs } from './http'
import { buildPollinationsRequest, pollinationsProvider } from './pollinations'
import { buildHfRequest, huggingfaceProvider, resolveHfConfig } from './huggingface'
import { generateWithFallback } from './index'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

function imageResponse(bytes = PNG, contentType = 'image/png') {
  return new Response(bytes, { status: 200, headers: { 'content-type': contentType } })
}
function textResponse(status: number, body = '', headers: Record<string, string> = {}) {
  return new Response(body, { status, headers })
}

const opts = { prompt: 'a red fox, flat illustration', width: 1280, height: 720, seed: 42 }

let fetchMock: ReturnType<typeof vi.fn>
let sleepSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  sleepSpy = vi.spyOn(deps, 'sleep').mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.stubEnv('POLLINATIONS_API_KEY', '')
  vi.stubEnv('POLLINATIONS_IMAGE_MODEL', '')
  vi.stubEnv('HF_TOKEN', '')
  vi.stubEnv('HUGGINGFACE_IMAGE_PROVIDER', '')
  vi.stubEnv('HUGGINGFACE_IMAGE_MODEL', '')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('http helpers', () => {
  it('parses Retry-After seconds and dates', () => {
    expect(parseRetryAfterMs('3')).toBe(3000)
    expect(parseRetryAfterMs(null)).toBeNull()
    expect(parseRetryAfterMs('garbage')).toBeNull()
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:05 GMT', now)).toBe(5000)
  })

  it('surfaces the underlying cause of fetch failures', () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND api-inference.huggingface.co'), {
      code: 'ENOTFOUND',
      hostname: 'api-inference.huggingface.co',
    })
    const err = new TypeError('fetch failed', { cause })
    expect(describeFetchError(err)).toBe(
      'fetch failed <- cause: ENOTFOUND getaddrinfo ENOTFOUND api-inference.huggingface.co',
    )
  })

  it('fits dimensions to ~1MP keeping aspect ratio and multiples of 16', () => {
    expect(fitDimensions(1280, 720)).toEqual({ width: 1280, height: 720 })
    expect(fitDimensions(1920, 1080)).toEqual({ width: 1360, height: 768 })
    expect(fitDimensions(1080, 1920)).toEqual({ width: 768, height: 1360 })
    expect(fitDimensions(512, 512)).toEqual({ width: 512, height: 512 })
  })
})

describe('pollinations', () => {
  it('uses the authenticated gen.pollinations.ai endpoint with a Bearer key when POLLINATIONS_API_KEY is set', () => {
    const req = buildPollinationsRequest(opts, { POLLINATIONS_API_KEY: 'sk_test', POLLINATIONS_IMAGE_MODEL: 'flux' })
    expect(req.authenticated).toBe(true)
    expect(req.url.startsWith('https://gen.pollinations.ai/image/a%20red%20fox')).toBe(true)
    const url = new URL(req.url)
    expect(url.searchParams.get('width')).toBe('1280')
    expect(url.searchParams.get('height')).toBe('720')
    expect(url.searchParams.get('seed')).toBe('42')
    expect(url.searchParams.get('model')).toBe('flux')
    expect(url.searchParams.has('key')).toBe(false) // key goes in the header, not the URL
    expect(req.headers.Authorization).toBe('Bearer sk_test')
  })

  it('falls back to the anonymous legacy endpoint without a key', () => {
    const req = buildPollinationsRequest(opts, {})
    expect(req.authenticated).toBe(false)
    expect(req.url.startsWith('https://image.pollinations.ai/prompt/')).toBe(true)
    expect(req.headers.Authorization).toBeUndefined()
    expect(new URL(req.url).searchParams.get('nologo')).toBe('true')
  })

  it('sends the key and returns the image buffer', async () => {
    vi.stubEnv('POLLINATIONS_API_KEY', 'sk_test')
    fetchMock.mockResolvedValueOnce(imageResponse())
    const result = await pollinationsProvider.generate(opts)
    expect(result.provider).toBe('pollinations')
    expect([...result.buffer]).toEqual([...PNG])
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('https://gen.pollinations.ai/image/')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test')
  })

  it('retries on 429 honouring Retry-After, then succeeds', async () => {
    vi.stubEnv('POLLINATIONS_API_KEY', 'sk_test')
    fetchMock
      .mockResolvedValueOnce(textResponse(429, 'slow down', { 'retry-after': '2' }))
      .mockResolvedValueOnce(textResponse(502, 'upstream'))
      .mockResolvedValueOnce(imageResponse())
    const result = await pollinationsProvider.generate(opts)
    expect(result.buffer.length).toBe(PNG.length)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 2000)
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 3000) // 1500 * 2^1 backoff
  })

  it('gives up after 3 attempts with status, mode and body in the message', async () => {
    fetchMock.mockImplementation(async () => textResponse(429, '{"error":"Too many requests"}'))
    await expect(pollinationsProvider.generate(opts)).rejects.toThrow(
      /Pollinations 429 .*anonymous tier rate-limited.*image\.pollinations\.ai, anonymous, 3 attempt\(s\).*Too many requests/,
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry on 401 and explains the key problem', async () => {
    vi.stubEnv('POLLINATIONS_API_KEY', 'sk_bad')
    fetchMock.mockResolvedValueOnce(textResponse(401, 'unauthorized'))
    await expect(pollinationsProvider.generate(opts)).rejects.toThrow(/Pollinations 401.*POLLINATIONS_API_KEY/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects non-image payloads', async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, '{"ok":false}', { 'content-type': 'application/json' }))
    await expect(pollinationsProvider.generate(opts)).rejects.toThrow(/non-image content-type/)
  })

  it('reports network failure causes', async () => {
    const cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
    fetchMock.mockRejectedValue(new TypeError('fetch failed', { cause }))
    await expect(pollinationsProvider.generate(opts)).rejects.toThrow(
      /Pollinations .*network error after 3 attempt\(s\): fetch failed <- cause: ECONNRESET read ECONNRESET/,
    )
  })

  it('does not retry timeouts', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    await expect(pollinationsProvider.generate(opts)).rejects.toThrow(/network error after 1 attempt\(s\): timeout/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('huggingface', () => {
  it('defaults to the router nscale provider with FLUX.1-schnell', () => {
    expect(resolveHfConfig({})).toEqual({ provider: 'nscale', model: 'black-forest-labs/FLUX.1-schnell' })
    const req = buildHfRequest(opts, {})
    expect(req.url).toBe('https://router.huggingface.co/nscale/v1/images/generations')
    expect(JSON.parse(req.body)).toEqual({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt: opts.prompt,
      size: '1280x720',
      n: 1,
      response_format: 'b64_json',
    })
  })

  it('supports hf-inference and the HUGGINGFACE_IMAGE_MODEL override', () => {
    const req = buildHfRequest(opts, { HUGGINGFACE_IMAGE_PROVIDER: 'hf-inference', HUGGINGFACE_IMAGE_MODEL: 'org/my-model' })
    expect(req.url).toBe('https://router.huggingface.co/hf-inference/models/org/my-model')
    expect(JSON.parse(req.body)).toEqual({ inputs: opts.prompt, parameters: { width: 1280, height: 720, seed: 42 } })
    expect(resolveHfConfig({ HUGGINGFACE_IMAGE_PROVIDER: 'hf-inference' }).model).toBe(
      'stabilityai/stable-diffusion-3-medium-diffusers',
    )
    expect(resolveHfConfig({ HUGGINGFACE_IMAGE_MODEL: 'org/x' }).model).toBe('org/x')
  })

  it('rejects unknown providers', () => {
    expect(() => resolveHfConfig({ HUGGINGFACE_IMAGE_PROVIDER: 'replicate' })).toThrow(/not supported/)
  })

  it('never calls the retired api-inference host', async () => {
    vi.stubEnv('HF_TOKEN', 'hf_test')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(PNG).toString('base64') }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const result = await huggingfaceProvider.generate(opts)
    expect(result).toMatchObject({ provider: 'huggingface', model: 'black-forest-labs/FLUX.1-schnell' })
    expect([...result.buffer]).toEqual([...PNG])
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain('api-inference.huggingface.co')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer hf_test')
  })

  it('decodes raw image bytes from hf-inference', async () => {
    vi.stubEnv('HF_TOKEN', 'hf_test')
    vi.stubEnv('HUGGINGFACE_IMAGE_PROVIDER', 'hf-inference')
    fetchMock.mockResolvedValueOnce(imageResponse(PNG, 'image/jpeg'))
    const result = await huggingfaceProvider.generate(opts)
    expect([...result.buffer]).toEqual([...PNG])
  })

  it('retries 503 then succeeds', async () => {
    vi.stubEnv('HF_TOKEN', 'hf_test')
    vi.stubEnv('HUGGINGFACE_IMAGE_PROVIDER', 'hf-inference')
    fetchMock.mockResolvedValueOnce(textResponse(503, 'loading')).mockResolvedValueOnce(imageResponse())
    await huggingfaceProvider.generate(opts)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenCalledWith(2000)
  })

  it('explains gated-model 403s without retrying', async () => {
    vi.stubEnv('HF_TOKEN', 'hf_test')
    vi.stubEnv('HUGGINGFACE_IMAGE_PROVIDER', 'hf-inference')
    fetchMock.mockResolvedValueOnce(textResponse(403, 'Access to model is restricted'))
    await expect(huggingfaceProvider.generate(opts)).rejects.toThrow(
      /HuggingFace 403.*gated model.*hf-inference\/stabilityai\/stable-diffusion-3-medium-diffusers, 1 attempt\(s\).*restricted/,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('flags malformed nscale responses', async () => {
    vi.stubEnv('HF_TOKEN', 'hf_test')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    await expect(huggingfaceProvider.generate(opts)).rejects.toThrow(/missing data\[0\]\.b64_json/)
  })

  it('is unavailable without HF_TOKEN', () => {
    expect(huggingfaceProvider.isAvailable()).toBe(false)
  })
})

describe('generateWithFallback', () => {
  it('falls through to huggingface when pollinations fails, and aggregates errors when both fail', async () => {
    vi.stubEnv('HF_TOKEN', 'hf_test')
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('pollinations')) return textResponse(500, 'boom')
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(PNG).toString('base64') }] }), { status: 200 })
    })
    const ok = await generateWithFallback(opts)
    expect(ok.provider).toBe('huggingface')

    fetchMock.mockImplementation(async () => textResponse(500, 'boom'))
    await expect(generateWithFallback(opts)).rejects.toThrow(
      /All image providers failed: pollinations: Pollinations 500 .* \| huggingface: HuggingFace 500/,
    )
  })
})
