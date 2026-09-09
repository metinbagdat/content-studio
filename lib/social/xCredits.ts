/**
 * X (Twitter) API pay-per-use credit balance for admin warnings.
 * Balance: GET /2/usage/credits (developer-platform payer). Fallback: FAILED posts with 402.
 */

import { prisma } from '../prisma'
import { parseXApiError } from './xApi'

/** Official console — Billing → Credits (top-up / purchase). */
export const X_CREDITS_BILLING_URL =
  process.env.X_CREDITS_BILLING_URL?.trim() || 'https://console.x.com'

/** Warn when spendable USD is at or below this (URL posts cost ~$0.20 each). */
export const X_CREDITS_LOW_USD = Number(process.env.X_CREDITS_LOW_USD || 5)

export type XCreditsLevel = 'ok' | 'low' | 'exhausted' | 'unknown'

export type XCreditsStatus = {
  level: XCreditsLevel
  /** Spendable USD when API returned a balance. */
  totalBalanceUsd: number | null
  prepaidBalanceUsd: number | null
  freeBalanceUsd: number | null
  source: 'api' | 'failed_posts' | 'none'
  failedCreditPosts: number
  billingUrl: string
  message: string
  fetchedAt: string | null
  error?: string
}

type UsageCreditsData = {
  total_balance: number
  prepaid_balance: number
  free_balance: number
}

let cachedAppBearer: { token: string; expiresAt: number } | null = null

async function getXAppBearerToken(): Promise<string | null> {
  const clientId = process.env.X_CLIENT_ID?.trim()
  const clientSecret = process.env.X_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null

  if (cachedAppBearer && cachedAppBearer.expiresAt > Date.now() + 60_000) {
    return cachedAppBearer.token
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) {
    console.warn('[xCredits] app bearer failed', res.status, (await res.text()).slice(0, 200))
    return null
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null
  const ttlMs = Math.max(60, Number(data.expires_in) || 3600) * 1000
  cachedAppBearer = { token: data.access_token, expiresAt: Date.now() + ttlMs }
  return data.access_token
}

export async function fetchXUsageCredits(
  bearerToken: string,
): Promise<{ data: UsageCreditsData | null; error?: string }> {
  const res = await fetch('https://api.x.com/2/usage/credits', {
    headers: { Authorization: `Bearer ${bearerToken}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    // api.x.com may 404 on some hosts — retry api.twitter.com
    if (res.status === 404 || res.status === 400) {
      const res2 = await fetch('https://api.twitter.com/2/usage/credits', {
        headers: { Authorization: `Bearer ${bearerToken}` },
        cache: 'no-store',
      })
      if (!res2.ok) {
        const body = await res2.text()
        return { data: null, error: parseXApiError(res2.status, body) }
      }
      const json2 = (await res2.json()) as { data?: UsageCreditsData }
      return { data: json2.data ?? null }
    }
    const body = await res.text()
    return { data: null, error: parseXApiError(res.status, body) }
  }
  const json = (await res.json()) as { data?: UsageCreditsData }
  return { data: json.data ?? null }
}

export function isXCreditErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false
  return /402|credits?\s*deplet|insufficient\s*credit|Payment Required|kredi/i.test(message)
}

function levelFromBalance(total: number): XCreditsLevel {
  if (total <= 0) return 'exhausted'
  if (total <= X_CREDITS_LOW_USD) return 'low'
  return 'ok'
}

function formatUsd(n: number): string {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

async function countFailedCreditPosts(): Promise<number> {
  const failed = await prisma.socialMediaPost.findMany({
    where: { platform: 'TWITTER', status: 'FAILED' },
    select: { error: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  return failed.filter((p) => isXCreditErrorMessage(p.error)).length
}

export async function getXCreditsStatus(): Promise<XCreditsStatus> {
  const billingUrl = X_CREDITS_BILLING_URL
  const failedCreditPosts = await countFailedCreditPosts()
  const fetchedAt = new Date().toISOString()

  try {
    const bearer = await getXAppBearerToken()
    if (bearer) {
      const { data, error } = await fetchXUsageCredits(bearer)
      if (data && typeof data.total_balance === 'number') {
        const level = levelFromBalance(data.total_balance)
        const balanceLabel = formatUsd(data.total_balance)
        let message: string
        if (level === 'exhausted') {
          message = `X API kredisi tükendi (bakiye ${balanceLabel}). Yayınlar 402 ile düşer — kredi yükleyin.`
        } else if (level === 'low') {
          message = `X API kredisi düşük: ${balanceLabel} kaldı (eşik ≤ ${formatUsd(X_CREDITS_LOW_USD)}).`
        } else {
          message = `X API kredisi: ${balanceLabel} kaldı.`
        }
        if (failedCreditPosts > 0 && level !== 'ok') {
          message += ` ${failedCreditPosts} başarısız X postu kredi hatası gösteriyor.`
        }
        return {
          level,
          totalBalanceUsd: data.total_balance,
          prepaidBalanceUsd: data.prepaid_balance ?? null,
          freeBalanceUsd: data.free_balance ?? null,
          source: 'api',
          failedCreditPosts,
          billingUrl,
          message,
          fetchedAt,
        }
      }
      if (error && isXCreditErrorMessage(error)) {
        return {
          level: 'exhausted',
          totalBalanceUsd: 0,
          prepaidBalanceUsd: null,
          freeBalanceUsd: null,
          source: 'api',
          failedCreditPosts,
          billingUrl,
          message: `X API kredisi tükendi (usage/credits 402). ${failedCreditPosts ? `${failedCreditPosts} başarısız post. ` : ''}Kredi yükleyin.`,
          fetchedAt,
          error,
        }
      }
    }
  } catch (err) {
    console.warn('[xCredits]', err instanceof Error ? err.message : err)
  }

  if (failedCreditPosts > 0) {
    return {
      level: 'exhausted',
      totalBalanceUsd: null,
      prepaidBalanceUsd: null,
      freeBalanceUsd: null,
      source: 'failed_posts',
      failedCreditPosts,
      billingUrl,
      message: `${failedCreditPosts} X postu kredi/402 hatasıyla FAILED — bakiye muhtemelen tükendi. console.x.com → Billing → Credits.`,
      fetchedAt,
    }
  }

  return {
    level: 'unknown',
    totalBalanceUsd: null,
    prepaidBalanceUsd: null,
    freeBalanceUsd: null,
    source: 'none',
    failedCreditPosts: 0,
    billingUrl,
    message:
      'X API kredi bakiyesi okunamadı. Toplu yayın 402 verirse console.x.com → Billing → Credits üzerinden yükleyin.',
    fetchedAt,
  }
}
