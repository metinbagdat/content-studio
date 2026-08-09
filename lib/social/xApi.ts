/** X (Twitter) API v2 helpers and actionable error messages. */

export type XApiDiagnosis = {
  configured: boolean
  tokenPresent: boolean
  hint: string
  portalSteps: string[]
}

export function xApiDiagnosis(hasToken: boolean): XApiDiagnosis {
  return {
    configured: Boolean(process.env.X_CLIENT_ID?.trim() && process.env.X_CLIENT_SECRET?.trim()),
    tokenPresent: hasToken,
    hint:
      'X API 403 genelde ücretsiz planda tweet yazma kapalıdır — Developer Portal → Basic tier ($100/ay) veya Pay-per-use gerekir.',
    portalSteps: [
      'https://developer.x.com → Projects & Apps → uygulamanız',
      'User authentication settings → Edit → Read and write',
      'App permissions: Read and write',
      'Type of App: Web App, Callback: https://studio.egitim.today/api/social/callback/twitter',
      'Developer Portal → Products → X API → Basic veya Pay-per-use abonelik',
      'Sosyal ekranda Kes → OAuth bağla (yeniden yetkilendirme)',
    ],
  }
}

export function parseXApiError(status: number, body: string): string {
  if (status === 403) {
    let detail = body
    try {
      const j = JSON.parse(body) as { detail?: string; title?: string }
      detail = j.detail || j.title || body
    } catch {
      /* raw */
    }
    return (
      `X API 403 — tweet yazma izni yok: ${detail.slice(0, 200)}. ` +
      'developer.x.com → Basic/Pay-per-use plan + OAuth Read and write → hesabı yeniden bağlayın.'
    )
  }
  if (status === 401) {
    return `X API 401 — token geçersiz; Sosyal ekranda Kes → OAuth bağla. ${body.slice(0, 120)}`
  }
  if (status === 429) {
    return `X API 429 — rate limit; birkaç dakika bekleyin.`
  }
  return `X API ${status}: ${body.slice(0, 300)}`
}

/** Probe whether current token can post (dry run — posts a test tweet only if X_TEST_TWEET=true). */
export async function probeXWriteAccess(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  if (!accessToken || accessToken === 'dry-run') {
    return { ok: false, error: 'OAuth token yok veya dry-run' }
  }
  if (process.env.X_TEST_TWEET !== 'true') {
    const res = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: parseXApiError(res.status, body) }
    }
    return { ok: true }
  }
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: `[test] egitim.today Content Studio ${new Date().toISOString()}` }),
  })
  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: parseXApiError(res.status, body) }
  }
  return { ok: true }
}
