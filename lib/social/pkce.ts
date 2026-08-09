import { createHash, randomBytes } from 'crypto'

const TIKTOK_PKCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/** TikTok Login Kit — code_challenge = hex(SHA256(verifier)), not base64url. */
export function generateTikTokPkce(): { verifier: string; challenge: string } {
  const bytes = randomBytes(64)
  let verifier = ''
  for (let i = 0; i < 64; i++) {
    verifier += TIKTOK_PKCE_CHARS[bytes[i]! % TIKTOK_PKCE_CHARS.length]
  }
  const challenge = createHash('sha256').update(verifier).digest('hex')
  return { verifier, challenge }
}

export function pkceCookieName(platform: 'twitter' | 'linkedin' | 'tiktok'): string {
  return `oauth_pkce_${platform}`
}
