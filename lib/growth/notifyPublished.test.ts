import { describe, expect, it, vi } from 'vitest'
import {
  getGrowthContentWebhookConfig,
  notifyLearnconContentPublished,
  publicLearningCenterArticleUrl,
  scheduleLearnconGrowthNotify,
} from './notifyPublished'

describe('publicLearningCenterArticleUrl', () => {
  it('maps wp.egitim.today permalinks to /yazilar/{slug}', () => {
    expect(publicLearningCenterArticleUrl('https://wp.egitim.today/yks-calisma-duzeni/')).toBe(
      'https://blog.egitim.today/yazilar/yks-calisma-duzeni',
    )
  })

  it('normalizes an existing LC URL and prefers an explicit slug', () => {
    expect(publicLearningCenterArticleUrl('https://blog.egitim.today/yazilar/tyt-net-hesaplama/')).toBe(
      'https://blog.egitim.today/yazilar/tyt-net-hesaplama',
    )
    expect(publicLearningCenterArticleUrl('https://wp.egitim.today/old/', 'tyt-matematik-90-net')).toBe(
      'https://blog.egitim.today/yazilar/tyt-matematik-90-net',
    )
  })
})

describe('getGrowthContentWebhookConfig', () => {
  it('is unconfigured without a secret', () => {
    expect(getGrowthContentWebhookConfig({}).configured).toBe(false)
    expect(getGrowthContentWebhookConfig({ GROWTH_CONTENT_WEBHOOK_URL: 'https://example.com' }).configured).toBe(
      false,
    )
  })

  it('uses the prod LearnCon URL by default when a secret is set', () => {
    const cfg = getGrowthContentWebhookConfig({ GROWTH_CONTENT_WEBHOOK_SECRET: 'secret' })
    expect(cfg.configured).toBe(true)
    expect(cfg.url).toBe('https://www.egitim.today/api/growth/content-published')
  })
})

describe('notifyLearnconContentPublished', () => {
  const env = {
    GROWTH_CONTENT_WEBHOOK_URL: 'https://www.egitim.today/api/growth/content-published',
    GROWTH_CONTENT_WEBHOOK_SECRET: 'test-secret',
  }

  it('skips when the secret is missing', async () => {
    const fetch = vi.fn()
    const result = await notifyLearnconContentPublished(
      { csSourceId: 'src-1', link: 'https://wp.egitim.today/yks-calisma-duzeni/' },
      { env: {}, fetch: fetch as unknown as typeof globalThis.fetch },
    )
    expect(result).toMatchObject({ ok: true, skipped: true, reason: 'not_configured' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('POSTs the LearnCon contract (secret header + cs_source_id + published_url)', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(env.GROWTH_CONTENT_WEBHOOK_URL)
      const headers = new Headers(init?.headers)
      expect(headers.get('x-growth-webhook-secret')).toBe('test-secret')
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(JSON.parse(String(init?.body))).toEqual({
        published_url: 'https://blog.egitim.today/yazilar/yks-calisma-duzeni',
        platform: 'wordpress',
        cs_source_id: 'src-1',
      })
      return { ok: true, status: 200 } as Response
    })
    const result = await notifyLearnconContentPublished(
      { csSourceId: 'src-1', link: 'https://wp.egitim.today/yks-calisma-duzeni/' },
      { env, fetch: fetch as unknown as typeof globalThis.fetch },
    )
    expect(result).toEqual({ ok: true, skipped: false, status: 200, reason: undefined })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not throw on timeout and never includes the secret in the result', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const err = new Error('This operation was aborted')
      err.name = 'AbortError'
      if (init?.signal) {
        throw err
      }
      throw err
    })
    const result = await notifyLearnconContentPublished(
      { csSourceId: 'src-1', publishedUrl: 'https://blog.egitim.today/yazilar/tyt-net-hesaplama' },
      { env, fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs: 5 },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('timeout')
    expect(JSON.stringify(result)).not.toContain('test-secret')
  })

  it('scheduleLearnconGrowthNotify does not reject when LearnCon returns 500', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 500 }) as Response)
    const warn = vi.fn()
    scheduleLearnconGrowthNotify(
      { csSourceId: 'src-1', link: 'https://wp.egitim.today/yks-calisma-duzeni/' },
      { env, fetch: fetch as unknown as typeof globalThis.fetch, logger: { warn } },
    )
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(String(warn.mock.calls[0])).not.toContain('test-secret')
  })
})
