import { NextRequest } from 'next/server'
import { DEFAULT_ADMIN_API_KEY } from './adminKey'

/** Previous .env.example default — still accepted in non-production for local migration. */
const LEGACY_ADMIN_API_KEY = 'dev-admin-change-me'

function acceptedAdminKeys(): Set<string> {
  const keys = new Set<string>()
  const configured = process.env.ADMIN_API_KEY?.trim()
  if (configured) keys.add(configured)
  else keys.add(DEFAULT_ADMIN_API_KEY)
  if (process.env.NODE_ENV !== 'production') {
    keys.add(DEFAULT_ADMIN_API_KEY)
    keys.add(LEGACY_ADMIN_API_KEY)
  }
  return keys
}

export function requireAdmin(req: NextRequest): boolean {
  const header = req.headers.get('x-admin-key') || ''
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const provided = header || bearer
  if (!provided) return false
  return acceptedAdminKeys().has(provided)
}

export function brandCta(): string {
  const url = process.env.BRAND_URL || 'https://egitim.today'
  const name = process.env.BRAND_NAME || 'egitim.today'
  return `\n\n→ ${name}: ${url}`
}
