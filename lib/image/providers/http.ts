/**
 * Shared HTTP helpers for image providers: bounded retry with backoff on 429/5xx
 * (honouring Retry-After) and readable error messages that include status + cause.
 */

export const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

/** Indirection so unit tests can skip real waiting (vi.spyOn(deps, 'sleep')). */
export const deps = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}

export type RetryOptions = {
  /** Total attempts including the first one. */
  attempts: number
  /** Backoff base: delay = baseDelayMs * 2^(attempt-1), unless Retry-After says otherwise. */
  baseDelayMs: number
  /** Upper bound for any single wait (also caps Retry-After). */
  maxDelayMs: number
  /** Per-attempt timeout. */
  timeoutMs: number
}

export type FetchOutcome = {
  res: Response
  attempts: number
}

/** Parse Retry-After (seconds or HTTP date) into ms; null when absent/invalid. */
export function parseRetryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000)
  const date = Date.parse(value)
  if (Number.isFinite(date)) return Math.max(0, date - now)
  return null
}

/** Flatten `fetch failed` style errors so the underlying cause (ENOTFOUND, ECONNRESET, timeout…) is visible. */
export function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return `timeout (${err.message})`
  const parts = [err.message]
  let cause: unknown = (err as Error & { cause?: unknown }).cause
  let depth = 0
  while (cause && depth < 3) {
    if (cause instanceof Error) {
      const code = (cause as Error & { code?: string }).code
      const host = (cause as Error & { hostname?: string }).hostname
      parts.push([code, cause.message, host && !cause.message.includes(host) ? `host=${host}` : '']
        .filter(Boolean)
        .join(' '))
      cause = (cause as Error & { cause?: unknown }).cause
    } else {
      parts.push(String(cause))
      cause = undefined
    }
    depth++
  }
  return parts.join(' <- cause: ')
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ProviderRequestError'
  }
}

/**
 * fetch() with bounded retries on retryable HTTP statuses and network errors.
 * Returns the final Response (ok or not) so callers can build their own message;
 * throws only when every attempt failed at the network level.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions,
): Promise<FetchOutcome> {
  let lastNetworkError: unknown = null
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    const isLast = attempt === opts.attempts
    let res: Response
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) })
    } catch (err) {
      lastNetworkError = err
      // Don't multiply long timeouts; only retry fast network failures (ECONNRESET, DNS blips…).
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
      if (isLast || timedOut) {
        throw new ProviderRequestError(
          `network error after ${attempt} attempt(s): ${describeFetchError(err)}`,
        )
      }
      await deps.sleep(Math.min(opts.baseDelayMs * 2 ** (attempt - 1), opts.maxDelayMs))
      continue
    }

    if (res.ok || !RETRYABLE_STATUSES.has(res.status) || isLast) {
      return { res, attempts: attempt }
    }

    const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'))
    const backoff = opts.baseDelayMs * 2 ** (attempt - 1)
    // Drain the body so the connection can be reused.
    await res.arrayBuffer().catch(() => undefined)
    await deps.sleep(Math.min(retryAfter ?? backoff, opts.maxDelayMs))
  }
  throw new ProviderRequestError(
    `network error after ${opts.attempts} attempt(s): ${describeFetchError(lastNetworkError)}`,
  )
}

/** Short, single-line snippet of an error body (never the request, so no secrets). */
export async function bodySnippet(res: Response, max = 200): Promise<string> {
  const text = await res.text().catch(() => '')
  return text.replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Scale (w,h) down to at most maxPixels, keeping aspect ratio, rounded to `multiple`. */
export function fitDimensions(
  width: number,
  height: number,
  maxPixels = 1024 * 1024,
  multiple = 16,
): { width: number; height: number } {
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)))
  const round = (v: number) => Math.max(multiple, Math.floor((v * scale) / multiple) * multiple)
  return { width: round(width), height: round(height) }
}
